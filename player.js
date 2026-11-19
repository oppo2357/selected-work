const dialog = document.querySelector("dialog");
const video = dialog.querySelector("video");
const languageGroup = dialog.querySelector(".languages");
const details = {
  film: {title: "Sintel", description: "A vertical edit of the Blender Foundation trailer. English captions are in the picture.", file: "dialogue.mp4"},
  dub: {title: "Two voices", description: "The same two shots of Catalog ID Finder, narrated in English or Japanese.", file: "source-en.mp4"}
};
let revision = 0;
const captions = {
  en: "00:00:00.500 --> 00:00:02.369\nPaste the first row of your CSV.\n\n00:00:05.300 --> 00:00:07.102\nCheck which column holds the SKU.",
  ja: "00:00:00.500 --> 00:00:02.749\nCSVの一行目を貼り付けます。\n\n00:00:05.300 --> 00:00:07.434\nSKUの列を確認します。"
};

function selectMedia(file, position, resume) {
  const request = ++revision;
  video.onloadedmetadata = () => {
    if (request !== revision || !dialog.open) return;
    video.currentTime = Math.min(position, video.duration);
    if (resume) video.play().catch(() => {});
  };
  video.src = "media/" + file;
  video.load();
}

function setLanguage(language) {
  video.replaceChildren();
  if (!languageGroup.hidden) {
    const track = document.createElement("track");
    track.kind = "captions";
    track.label = language === "ja" ? "日本語" : "English";
    track.srclang = language;
    track.src = "data:text/vtt;charset=utf-8," + encodeURIComponent("WEBVTT\n\n" + captions[language] + "\n");
    track.default = true;
    video.append(track);
  }
  for (const option of languageGroup.querySelectorAll("button")) {
    option.setAttribute("aria-pressed", String(option.dataset.lang === language));
  }
}

for (const [id, project] of Object.entries(details)) {
  document.getElementById(id).addEventListener("click", () => {
    dialog.querySelector("h2").textContent = project.title;
    document.getElementById("description").textContent = project.description;
    languageGroup.hidden = id !== "dub";
    setLanguage("en");
    dialog.showModal();
    selectMedia(project.file, 0, true);
  });
}
for (const option of languageGroup.querySelectorAll("button")) {
  option.addEventListener("click", () => {
    if (option.getAttribute("aria-pressed") === "true") return;
    const language = option.dataset.lang;
    setLanguage(language);
    selectMedia(language === "ja" ? "dub-ja.mp4" : "source-en.mp4", video.currentTime, !video.paused && !video.ended);
  });
}
document.getElementById("close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  revision++;
  video.onloadedmetadata = null;
  video.pause();
  video.removeAttribute("src");
  video.load();
});
