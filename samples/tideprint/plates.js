/* All six separations are drawn directly for this game. Coordinates are on a 100-unit plate. */
const fills = (...paths) => paths.map(d => '<path d="' + d + '"/>').join('');
const lines = (width, ...paths) => paths.map(d => '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round"/>').join('');
const disk = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
const flock = (x, y, scale) => '<g transform="translate(' + x + ' ' + y + ') scale(' + scale + ')">' + lines(1.5, 'M0 3Q3 0 6 3Q9 0 12 3') + '</g>';
const waves = (x, y, count, length) => Array.from({length:count}, (_,i) => lines(1.25,'M'+(x+(i%2)*3)+' '+(y+i*3.3)+'q6 -2 12 0t12 0h'+length)).join('');
const cut = (d) => '<path fill-rule="evenodd" d="' + d + '"/>';

const editions = [
  {
    name:"Channel light", rule:"The teal plate is clamped. Shift the coral plate to put the lantern on its tower.",
    linked:[0,0,0,0], fixed:true, scramble:["1r","1u","1r"],
    art:[
      fills("M6 78L20 73 31 75 37 68 55 64 62 71 71 69 90 79 89 84H6Z","M39 69L44 36H54L61 69Z","M40 35H58V38H40Z","M44 26L49.2 21 55 26Z","M46 26H48V33H46ZM52 26H54V33H52Z")+lines(1.2,"M39 33H58M47 22L49.2 19.5 51 22")+waves(14,87,2,20)+flock(17,39,.64),
      disk(71,26,13)+fills("M43.6 46L54.6 42.5 55.7 49.4 42.5 53.5Z","M41 61L57.6 56 59 62 40.5 68Z","M43.5 27H54.5V32.5H43.5Z","M74 78L91 79.5 89 82H71Z")+lines(1.3,"M38 35H60","M16 78L30 78","M64 88H85")+flock(17,28,.55)
    ]
  },{
    name:"Trade winds",rule:"Both plates are free. Set the sails above the hull and bring the sun back to the horizon.",
    linked:[0,0,0,0],scramble:["0l","0u","1r","1d"],
    art:[
      fills("M10 70Q45 74 88 62L79 76Q56 85 25 80Z","M48 21L47 65 17 68Q32 53 48 21Z","M52 36L74 61 53 65Z")+lines(1.5,"M48 69L50 16","M52 68L78 60")+waves(14,85,3,18)+flock(18,31,.72),
      disk(74,29,12)+fills("M51 18Q73 31 84 58L52 63Z","M30 58L46 41 45 52 24 64Z","M20 76Q45 78 79 69L75 74Q50 82 23 79Z","M50 16L66 18 51 22Z")+lines(1.4,"M11 86H25","M65 85H82")+flock(12,21,.5)
    ]
  },{
    name:"The iron span",rule:"On the teal plate, a horizontal shift also tows coral up or down. Right tows down. Coral moves freely.",
    linked:[2,0,0,0],scramble:["1r","0r","0u","1d","0r","1l"],
    art:[
      fills("M9 61H91V66H9Z","M26 37H32V80H26ZM69 37H75V80H69Z","M19 77H38L36 82H19ZM63 77H80L80 82H64Z","M12 58V55H19V59Z","M83 58V55H88V59Z")+lines(1.7,"M9 59Q21 53 29 35Q49 69 72 35Q81 53 91 58","M34 45V60M40 51V60M46 54V60M53 54V60M60 50V60M66 44V60")+waves(24,85,2,33)+flock(53,31,.53),
      disk(47,33,12)+fills("M25 38H33L31 33H27ZM68 38H76L74 33H70Z","M10 64H90L87 68H13Z","M24 70H33V73H24ZM68 70H76V73H68Z")+lines(1.4,"M10 59Q22 53 29 36Q49 68 72 36Q82 53 90 58","M11 86H22","M72 82H89")+flock(72,22,.65)
    ]
  },{
    name:"Sounding bell",rule:"Lowering coral pulls teal right. Raising coral pulls teal left. Horizontal coral shifts stay level.",
    linked:[0,0,0,1],scramble:["0l","0u","1u","1u","1r","0d","0l"],
    art:[
      cut("M18 73Q27 69 28 54Q29 29 47 27Q48 20 51 19Q55 20 55 27Q76 30 77 54Q78 69 84 73V77H18ZM35 55A7.5 7.5 0 1 0 50 55A7.5 7.5 0 1 0 35 55ZM55 51A6 6 0 1 0 67 51A6 6 0 1 0 55 51Z")+lines(2,"M52 22V11","M17 80H84")+waves(22,86,2,19)+disk(77,29,2.1)+disk(83,22,1.4),
      fills("M26 64Q46 68 78 56L79 64Q49 76 22 70Z","M32 41Q37 30 50 29L61 30Q45 34 41 39Z","M24 75H80V79H24Z")+lines(2,"M35 55A7.5 7.5 0 1 0 50 55A7.5 7.5 0 1 0 35 55Z","M55 51A6 6 0 1 0 67 51A6 6 0 1 0 55 51Z")+disk(24,31,3)+disk(21,20,1.7)+disk(29,23,1.1)
    ]
  },{
    name:"The long sound",rule:"Teal tows coral horizontally. Coral tows teal vertically. The remaining shifts move just one plate.",
    linked:[1,0,0,2],scramble:["0r","0r","1u","1u","1r","0d","1r"],
    art:[
      fills("M13 59Q24 43 49 45Q63 46 73 56Q80 52 83 43Q85 36 91 36Q92 45 86 53Q93 48 95 48Q91 61 76 64Q61 79 40 76Q21 74 13 64Z","M41 71Q45 82 56 85Q59 81 56 74Z")+lines(1.8,"M33 48Q33 39 30 36Q26 33 24 34","M33 45Q37 37 44 37")+waves(13,86,2,27)+flock(57,24,.69),
      disk(67,32,12)+fills("M13 61Q26 69 46 69Q63 69 77 61Q66 76 44 77Q24 77 13 65Z","M54 49L58 45 60 51Z")+lines(1.15,"M21 67Q28 72 35 72","M20 70Q28 75 35 75","M16 82H29","M74 84H88")+disk(29,59,1.8)+flock(17,34,.42)
    ]
  },{
    name:"Night crossing",rule:"Teal tows at right angles. Coral tows teal along its own axis, in reverse for horizontal shifts.",
    linked:[2,1,-1,2],scramble:["0r","0d","1r","1d","0r","0d","1r","1d"],
    art:[
      cut("M29 43L36 37H64L71 43L67 51L64 75L68 80V84H31V80L36 75L32 51ZM38 50L41 72H59L62 50Z")+lines(2.2,"M40 37V30Q40 18 51 18Q61 18 61 30V37","M38 74H64","M38 27Q46 24 49 16")+fills("M31 44H70V48H31Z","M36 79H65V82H36Z")+waves(19,88,2,22)+disk(79,29,1.4),
      disk(76,24,10)+fills("M32 42H69L66 48H35Z","M40 72H61L64 76H37Z","M49 69Q42 64 49 58Q52 55 51 51Q61 63 53 69Z","M34 78H66L69 81H32Z")+lines(1.2,"M24 52L18 49M24 59H17M26 66L21 70M77 48L81 46M77 56H85M75 65L81 68")
    ]
  }
];
