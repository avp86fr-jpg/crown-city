/** Visual novel script + mission definitions. Text never sits over faces. */
import {directStory} from './screenplay.js';
export const CHAR = {
  chaos: { name: "CHAOS", color: "#9d5cff", portrait: "assets/portraits/chaos.jpg", side: "left" },
  hunter: { name: "HUNTER", color: "#5aaf40", portrait: "assets/portraits/hunter.jpg", side: "right" },
  fire: { name: "FIRE", color: "#ff6a20", portrait: "assets/portraits/fire.jpg", side: "right" },
  neural: { name: "NEURAL", color: "#c040ff", portrait: "assets/portraits/neural.jpg", side: "right" },
  mask: { name: "MASK", color: "#c0c0c8", portrait: "assets/portraits/mask.jpg", side: "right" },
  gold_mage: { name: "GOLD MAGE", color: "#f2c14e", portrait: "assets/portraits/gold_mage_reference.jpg", side: "right" },
  chief: { name: "CHIEF", color: "#c8c58c", portrait: "assets/portraits/chief.jpg", side: "right" },
  ice: { name: "ICE", color: "#95dce5", portrait: "assets/portraits/ice.jpg", side: "right" },
  steampunk: { name: "STEAMPUNK", color: "#d6ab76", portrait: "assets/portraits/steampunk.jpg", side: "right" },
  vera: { name: "VERA VALE", color: "#e31b23", portrait: "assets/vera/vera_mic_hd.webp", side: "right" },
};

export const MISSIONS = [
  { id: "cold_wallet", title: "COLD WALLET", blurb: "Jack a whale's seed-plate van." },
  { id: "pink_slip", title: "PINK SLIP HEAT", blurb: "Beat Fire at the Crown Grand Prix circuit." },
  { id: "gas_fees", title: "GAS FEES", blurb: "Pay Neural in cred. Lift a scrambler." },
  { id: "the_tell", title: "THE TELL", blurb: "Case the Palace. Pick a door." },
  { id: "house_odds", title: "HOUSE ODDS", blurb: "Vault, car, boat. Don't get rugged." },
  { id: "double", title: "DOUBLE OR NOTHING", blurb: "Gold Mage answers." },
];

/**
 * VN pages: { id, bg, left, right, speaker, text, choices?: [{label, set, next}] , next }
 * next may be a page id, "play", or "end".
 */
export const VN = {
  intro_news: {
    bg: "news", left: null, right: "vera", speaker: "vera",
    text: "Crown City News, I'm Vera Vale. A whale just rolled a titanium seed plate through the Strip under Metro escort. Twelve words, one crate, zero humility.",
    next: "intro_news2",
  },
  intro_news2: {
    bg: "news", left: "chaos", right: "vera", speaker: "vera",
    text: "And sources tell me CHAOS is back in town. The house would like a word. The street already has several.",
    next: "intro_garage",
  },
  intro_garage: {
    bg: "garage", left: "chaos", right: "hunter", speaker: "hunter",
    text: "You came. I figured the gas fees on pride would keep you out of Crown City.",
    next: "intro_garage2",
  },
  intro_garage2: {
    bg: "garage", left: "chaos", right: "hunter", speaker: "chaos",
    text: "Pride is cheap when a whale writes twelve words on a steel plate and calls it a personality.",
    next: "intro_garage3",
  },
  intro_garage3: {
    bg: "garage", left: "chaos", right: "hunter", speaker: "hunter",
    text: "Van's moving south on the Strip. Riot V8 is on the lot. We jack the crate, we lose the heat, we don't type the phrase. Ever.",
    next: "intro_garage4",
  },
  intro_garage4: {
    bg: "garage", left: "chaos", right: "hunter", speaker: "hunter",
    text: "After the lift: stash it with me — clean, quiet — or flip it on the street for a stupid stack of play chips and a bigger target on your visor.",
    choices: [
      { label: "Stash it with Hunter. Play it quiet.", set: { stash: "safe" }, next: "play" },
      { label: "Flip it. I like stupid stacks.", set: { stash: "flip" }, next: "play" },
    ],
  },

  m1_win_safe: {
    bg: "garage", left: "chaos", right: "hunter", speaker: "hunter",
    text: "Plate's in the floor safe. No one types those words, not even you. Fire already heard you boxed a whale. She wants a race.",
    next: "play",
  },
  m1_win_flip: {
    bg: "strip_night", left: "chaos", right: "hunter", speaker: "hunter",
    text: "You flipped a seed plate like a street card. Chips are up. So is every snitch on the promenade. Fire still wants that race. Try not to get rugged before the lights.",
    next: "play",
  },

  m2_intro: {
    bg: "strip_night", left: "chaos", right: "fire", speaker: "fire",
    text: "One full lap of the Crown Grand Prix circuit. Hit every gold gate, then cross the start line. You want a crew, Chaos? Show me you can drive.",
    next: "m2_intro2",
  },
  m2_intro2: {
    bg: "strip_night", left: "chaos", right: "fire", speaker: "chaos",
    text: "Good. I was out of trophies anyway. Try to keep your hood in the same block as me.",
    next: "play",
  },
  m2_win: {
    bg: "strip_night", left: "chaos", right: "fire", speaker: "fire",
    text: "Fine. You can drive. Don't get soft about it. Neural's loft is flashing your name like a mint alert. She doesn't work for exposure.",
    next: "play",
  },
  m2_lose: {
    bg: "strip_night", left: "chaos", right: "fire", speaker: "fire",
    text: "That's a participation trophy. Run it again when your wheels remember what asphalt is. Or go cry to Neural — she'll still charge you gas.",
    next: "play",
  },

  m3_intro: {
    bg: "loft", left: "chaos", right: "neural", speaker: "neural",
    text: "Camera grid on the Palace is a joke, but jokes still cost gas. You want me to brick it, you bring a Metro scrambler and a buy-in. Play chips. I don't touch wallets.",
    next: "m3_intro2",
  },
  m3_intro2: {
    bg: "loft", left: "chaos", right: "neural", speaker: "chaos",
    text: "Six hundred play chips. I can pay now, or you take it from the vault cut. Either way, we need that scrambler.",
    choices: [
      { label: "Pay now. Keep the vault cut clean.", set: { finance: "upfront" }, next: "play" },
      { label: "Take 600 from the vault cut.", set: { finance: "credit" }, next: "play" },
    ],
  },
  m3_win: {
    bg: "loft", left: "chaos", right: "neural", speaker: "neural",
    text: "Scrambler is pretty. I'll fade their eyes for ninety seconds when you call it. Mask is already inside, breathing like a ghost. Don't be late.",
    next: "play",
  },

  m4_intro: {
    bg: "palace", left: "chaos", right: "mask", speaker: "mask",
    text: "The vault line is a whisper if you wear my badge. It's a siren if Fire starts a fire. I don't do speeches. Pick a door.",
    choices: [
      { label: "Quiet. We use Mask's badge.", set: { heist: "quiet" }, next: "m4_quiet" },
      { label: "Loud. Fire takes the front.", set: { heist: "loud" }, next: "m4_loud" },
    ],
  },
  m4_quiet: {
    bg: "palace", left: "chaos", right: "mask", speaker: "chaos",
    text: "Quiet. If the house notices us, it already won.",
    next: "m4_case",
  },
  m4_loud: {
    bg: "palace", left: "chaos", right: "fire", speaker: "fire",
    text: "Loud it is. I'll warm the curb. You just don't miss the bag.",
    next: "m4_case",
  },
  m4_case: {
    bg: "palace", left: "chaos", right: "mask", speaker: "mask",
    text: "Case the south doors, walk the lot, learn the exit. When the vault breathes, you drive north to the marina. Boat's faster than a stuck mempool.",
    next: "play",
  },
  m4_win: {
    bg: "palace", left: "chaos", right: "hunter", speaker: "hunter",
    text: "Doors are mapped. Tomorrow we write our own odds. Try to sleep. Gold Mage doesn't.",
    next: "play",
  },

  m5_intro: {
    bg: "rooftop", left: "chaos", right: "gold_mage", speaker: "gold_mage",
    text: "The house always wins, Chaos. You can steal a plate. You can steal a bag. You cannot steal the shuffle.",
    next: "m5_intro2",
  },
  m5_intro2: {
    bg: "palace", left: "chaos", right: "hunter", speaker: "hunter",
    text: "Ignore the monologue. Bag, car, marina, island. If the stars light up, you already know the route.",
    next: "play",
  },
  m5_mid: {
    bg: "marina", left: "chaos", right: "neural", speaker: "neural",
    text: "Cameras are bricks. You have a window. Don't spend it posing.",
    next: "play",
  },
  m5_win: {
    bg: "marina", left: "chaos", right: "hunter", speaker: "hunter",
    text: "Bag's wet and the island's quiet. That's the problem. Gold Mage never lets a loss mint itself.",
    next: "play",
  },

  m6_intro: {
    bg: "desert", left: "chaos", right: "gold_mage", speaker: "gold_mage",
    text: "Your crew left a Nyx at the marina. Bring the bag to the east highway, Chaos. Metro is already on its way.",
    next: "play",
  },
  m6_end_safe: {
    bg: "news", left: "chaos", right: "vera", speaker: "vera",
    text: "Breaking: the Palace is short a vault bag, a whale is short a seed plate, and Crown City is long on rumours. Chaos, if you're watching — the house would still like a word.",
    next: "m6_end2",
  },
  m6_end_flip: {
    bg: "news", left: "chaos", right: "vera", speaker: "vera",
    text: "A street flip, a Palace job, and a boat that outran Metro. Play chips only, we're told. The whale has not recovered their twelve words. Stay classy, Crown City.",
    next: "m6_end2",
  },
  m6_end2: {
    bg: "strip_night", left: "chaos", right: "hunter", speaker: "chaos",
    text: "We didn't type the phrase. We didn't join the house. That's a win in any ledger.",
    next: "m6_end3",
  },
  m6_end3: {
    bg: "strip_night", left: "chaos", right: "hunter", speaker: "hunter",
    text: "Until the next shuffle. Come on, wildcard. First drink's play chips. I'm buying.",
    next: "end",
  },
};

export function missionFlow(id, flags) {
  switch (id) {
    case "cold_wallet":
      return {
        startVN: "intro_news",
        objectives: [
          { id: "enter_car", kind: "enter", near: "garage", hint: "Get in the Riot V8 on the garage lot. (E)" },
          { id: "hit_van", kind: "intercept", at: "van", r: 170, hint: "Disable the convoy van. Ram it or shoot its engine." },
          { id: "grab", kind: "collect", at: "van", r: 80, hint: "Stop close to the van and press E to take the sealed archive key." },
          { id: "lose_heat", kind: "loseWanted", hint: "Lose the Metro heat." },
          { id: "stash", kind: "goto", at: "garage", r: 90, hint: "Take the archive key back to Hunter's garage." },
        ],
        winVN: () => (flags.stash === "flip" ? "m1_win_flip" : "m1_win_safe"),
        onStart: { wanted: 0, spawnVan: true, unlock: ["riot"] },
        onGrab: { chips: (flags) => (flags.stash === "flip" ? 2500 : 800), wanted: 2 },
      };
    case "pink_slip":
      return {
        startVN: "m2_intro",
        objectives: [
          { id: "to_track", kind: "goto", at: "circuitPit", r: 100, vehicle: true, hint: "Meet Fire at the Crown Grand Prix pit desk." },
          { id: "race", kind: "race", laps: 1, hint: "Beat Fire over one full circuit lap. Follow every glowing gate." },
        ],
        winVN: "m2_win",
        loseVN: "m2_lose",
        onWin: { chips: 1500, unlock: ["dart", "stitch"] },
      };
    case "gas_fees":
      return {
        startVN: "m3_intro",
        objectives: [
          { id: "pay", kind: "goto", at: "neural", r: 70, hint: "Meet Neural at the loft. Settle the 600-chip fee or defer it." },
          { id: "lift", kind: "stealCop", at: "pd", r: 140, hint: "Jack a Metro PD cruiser or lift the scrambler near the precinct." },
          { id: "back", kind: "goto", at: "neural", r: 70, clearHeat: true, hint: "Lose the heat, then deliver the scrambler to Neural." },
        ],
        winVN: "m3_win",

        onWin: { chips: 400, unlock: ["metro"], flags: { scrambler: true } },
      };
    case "the_tell":
      return {
        startVN: "m4_intro",
        objectives: [
          { id: "case", kind: "goto", at: "casinoDoor", r: 80, foot: true, hold: 2, hint: "On foot: case the Crown Palace south doors." },
          { id: "lot", kind: "goto", at: "casinoLot", r: 100, foot: true, hold: 2, hint: "On foot: walk the Palace lot. Learn the exit." },
          { id: "exit", kind: "goto", at: "marina", r: 100, hint: "Trace the getaway to the marina." },
        ],
        winVN: "m4_win",
      };
    case "house_odds":
      return {
        startVN: "m5_intro",
        objectives: [
          { id: "door", kind: "goto", at: "casinoDoor", r: 70, hint: "Hit the Palace south doors." },
          { id: "vault", kind: "collect", at: "casino", r: 90, hack: 3, hint: "Stop at the archive. Press E, then stay still for the transfer." },
          { id: "marina", kind: "goto", at: "marina", r: 90, hint: "Drive the bag to the marina." },
          { id: "boat", kind: "enterBoat", at: "marina", hint: "Get in a boat." },
          { id: "island", kind: "goto", at: "dropIsland", r: 80, hint: "Run the harbour to the drop island." },
        ],
        midVN: { after: "vault", page: "m5_mid" },
        winVN: "m5_win",
        onWin: { unlock: ["nyx"] },
      };
    case "double":
      return {
        startVN: "m6_intro",
        objectives: [
          { id: "return", kind: "goto", at: "marina", r: 100, hint: "Return to the marina. Your final getaway car is waiting." },
          { id: "getaway", kind: "enter", near: "marina", vehicle: "nyx", hint: "Get into the Nyx at the marina. (E)" },
          { id: "highway", kind: "goto", at: "desert", r: 120, hint: "Run the bag out the east highway to the city limits." },
          { id: "survive", kind: "loseWanted", hint: "Shake Gold Mage's heat." },
        ],
        winVN: () => (flags.stash === "flip" ? "m6_end_flip" : "m6_end_safe"),
        onStart: { wanted: 3, unlock: ["nyx"] },
      };
    default:
      return null;
  }
}

directStory(VN, MISSIONS);
