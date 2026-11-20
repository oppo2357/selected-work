"""Replay fictional Gumroad sales against an in-memory Airtable upsert contract."""
from datetime import datetime
import json


def airtable_fields(sale):
    if not sale["id"] or not sale["product_id"] or not sale["email"]:
        raise ValueError("Missing sale identity, product or email")
    if sale["currency"] != "usd" or type(sale["price"]) is not int or sale["price"] < 0:
        raise ValueError("This sample expects USD prices in integer cents")
    created = datetime.fromisoformat(sale["created_at"])
    if created.utcoffset() is None:
        raise ValueError("Sale time needs a time zone")
    return {
        "Gumroad sale ID": sale["id"], "Customer email": sale["email"],
        "Product ID": sale["product_id"], "Sold at": created.isoformat(),
        "Original price (USD cents)": sale["price"], "Refunded": sale.get("refunded") is True,
        "Partially refunded": sale.get("partially_refunded") is True,
    }


def sync(read_page, patch_table):
    cursor = None
    visited = set()
    while True:
        page = read_page(cursor)
        if page.get("success") is not True:
            raise RuntimeError("Sales page could not be read")
        records = [{"fields": airtable_fields(sale)} for sale in page["sales"]]
        for start in range(0, len(records), 10):
            batch = records[start:start + 10]
            body = {"performUpsert": {"fieldsToMergeOn": ["Gumroad sale ID"]}, "records": batch}
            response = patch_table(body)
            expected = [r["fields"]["Gumroad sale ID"] for r in batch]
            actual = [r["fields"]["Gumroad sale ID"] for r in response["records"]]
            if sorted(actual) != sorted(expected):
                raise RuntimeError("Destination returned an incomplete receipt")
        cursor = page.get("next_page_key")
        if not cursor:
            return
        if cursor in visited:
            raise RuntimeError("Repeated sales page key")
        visited.add(cursor)


def demonstrate():
    base = dict(currency="usd", email="reader@example.org", partially_refunded=False)
    first = dict(base, id="demo-701", product_id="field-guide", price=1900,
                 created_at="2026-11-17T09:12:00Z")
    second = dict(base, id="demo-702", product_id="field-notes", price=2900,
                  created_at="2026-11-17T10:04:00Z")
    third = dict(base, id="demo-703", product_id="field-guide", price=1900,
                 created_at="2026-11-17T11:23:00Z", email="sam@example.org")
    pages = {None: {"success": True, "sales": [first, second], "next_page_key": "next"},
             "next": {"success": True, "sales": [third]}}
    table = {}
    def apply(body):
        assert body["performUpsert"]["fieldsToMergeOn"] == ["Gumroad sale ID"]
        assert 1 <= len(body["records"]) <= 10
        for record in body["records"]:
            fields = record["fields"]
            table.setdefault(fields["Gumroad sale ID"], {}).update(fields)
        return {"records": body["records"]}

    # The first page committed before the second page became temporarily unavailable.
    def interrupted(cursor):
        if cursor == "next":
            raise ConnectionError("Simulated timeout on page two")
        return pages[cursor]
    try:
        sync(interrupted, apply)
    except ConnectionError:
        pass
    assert len(table) == 2
    sync(pages.__getitem__, apply)
    assert len(table) == 3
    # A person adds a follow-up note in Airtable between imports.
    table["demo-702"]["Follow-up note"] = "Requested an invoice"
    first["refunded"] = True
    second["partially_refunded"] = True
    sync(pages.__getitem__, apply)
    snapshot = json.dumps(table, sort_keys=True)
    sync(pages.__getitem__, apply)
    assert json.dumps(table, sort_keys=True) == snapshot
    assert len(table) == 3 and table["demo-701"]["Refunded"] and table["demo-702"]["Partially refunded"]
    assert table["demo-702"]["Follow-up note"] == "Requested an invoice"
    assert table["demo-701"]["Customer email"] == table["demo-702"]["Customer email"]
    try:
        sync(pages.__getitem__, lambda _: {"records": []})
    except RuntimeError as error:
        assert str(error) == "Destination returned an incomplete receipt"
    else:
        raise AssertionError("Incomplete writes must fail the run")
    for row in table.values():
        print(json.dumps(row))


if __name__ == "__main__":
    demonstrate()
