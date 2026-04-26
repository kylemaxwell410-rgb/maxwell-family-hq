// Curated activity ideas for the "I'm Bored" tile. Outdoor preferred unless it's wet.

const OUTDOOR = [
  'Build a fort outside with sticks and blankets',
  'Sidewalk-chalk drawing competition',
  'Catch bugs in a jar (with holes for air) and let them go',
  'Make an obstacle course in the yard',
  'Hide-and-seek tournament',
  'Pick wildflowers and make a bouquet for Mom',
  'Race the dogs around the yard',
  'Set up a bean-bag toss',
  'Play kickball or four-square',
  'Spy on the chickens — count their eggs',
  'Make a fairy house out of bark and leaves',
  'Practice soccer ball juggling — see who gets the most',
  'Go on a treasure hunt — make a map first',
  'Plant a seed in a cup and label it',
  'Wash bikes with the hose',
  'Pretend the grass is lava and only step on stones',
  'Have a watermelon-seed-spitting contest',
  'Track footprints in the dirt — try to identify the animal',
  'Make a paper-plane test flight zone',
  'Set up a lemonade stand for the family',
  'Practice handstands on the grass',
  'Skip rocks at the pond',
  'Make a nature-treasure bracelet from string + leaves',
  'Build the world\'s biggest stick pile',
  'Hose-down sprinkler dance party',
  'Find five different shapes in the clouds',
  'Race the sunset — try to do 20 jumping jacks before dark',
  'Mud-pie kitchen — make a "menu"',
  'See how many laps around the house in 5 minutes',
  'Plant tag — every kid is a tree if they touch one',
];

const INDOOR = [
  'Build a pillow fort and read in it',
  'Bake cookies (ask a parent first)',
  'Have a dance party — pick a song each',
  'Draw a comic book about the family pets',
  'Set up a sock-puppet show',
  'Make a marble run with paper towel tubes',
  'Play board games — losers do 10 jumping jacks',
  'Write a thank-you note to a teacher',
  'Set up a lego challenge — tallest tower in 10 minutes',
  'Watch the rain and write a poem about it',
  'Origami contest — try paper cranes',
  'Make up a dance routine to your favorite song',
  'Play "Would you rather" with the family',
  'Build a cardboard-box racetrack for toy cars',
  'Have a paper-airplane-distance contest',
  'Make a list of 25 things you\'re thankful for',
  'Have a shadow-puppet show with a flashlight',
  'Try to balance a book on your head while doing things',
  'Sort through old toys and pick some to donate',
  'Play "Simon Says" — kid leader',
];

function pickRandom(list, prev = null) {
  if (list.length === 0) return null;
  let i = Math.floor(Math.random() * list.length);
  if (list[i] === prev && list.length > 1) i = (i + 1) % list.length;
  return list[i];
}

// Returns one suggestion. If wet (rain/snow forecast), prefer indoor; otherwise prefer outdoor.
export function suggestActivity({ wet = false, prev = null } = {}) {
  if (wet) return pickRandom(INDOOR, prev);
  // Sunny — 85% outdoor / 15% indoor variety.
  return Math.random() < 0.85 ? pickRandom(OUTDOOR, prev) : pickRandom(INDOOR, prev);
}
