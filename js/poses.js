// ═══════════════════════════════════════════════════════════════
// POSE DEFINITIONS — all 33 MediaPipe landmarks targeted
// x, y are normalized (0-1). x=0 left, y=0 top.
// ═══════════════════════════════════════════════════════════════

const ACCURACY_THRESHOLD = 68; // % to start hold timer
const HOLD_DURATION_MS   = 5000; // 5 seconds

// Helper: build a full 33-landmark map from a simplified spec
function buildTargets(spec) {
  // spec: { [lmIndex]: {x,y} }
  // we fill gaps with sensible neutral defaults if not specified
  const base = {
    [LM.NOSE]:            {x:0.50,y:0.18},
    [LM.LEFT_EYE_INNER]: {x:0.46,y:0.16},
    [LM.LEFT_EYE]:        {x:0.44,y:0.16},
    [LM.LEFT_EYE_OUTER]:  {x:0.42,y:0.16},
    [LM.RIGHT_EYE_INNER]: {x:0.54,y:0.16},
    [LM.RIGHT_EYE]:       {x:0.56,y:0.16},
    [LM.RIGHT_EYE_OUTER]: {x:0.58,y:0.16},
    [LM.LEFT_EAR]:        {x:0.40,y:0.18},
    [LM.RIGHT_EAR]:       {x:0.60,y:0.18},
    [LM.MOUTH_LEFT]:      {x:0.46,y:0.22},
    [LM.MOUTH_RIGHT]:     {x:0.54,y:0.22},
    [LM.LEFT_SHOULDER]:   {x:0.36,y:0.40},
    [LM.RIGHT_SHOULDER]:  {x:0.64,y:0.40},
    [LM.LEFT_ELBOW]:      {x:0.30,y:0.52},
    [LM.RIGHT_ELBOW]:     {x:0.70,y:0.52},
    [LM.LEFT_WRIST]:      {x:0.28,y:0.64},
    [LM.RIGHT_WRIST]:     {x:0.72,y:0.64},
    [LM.LEFT_PINKY]:      {x:0.26,y:0.68},
    [LM.RIGHT_PINKY]:     {x:0.74,y:0.68},
    [LM.LEFT_INDEX]:      {x:0.27,y:0.67},
    [LM.RIGHT_INDEX]:     {x:0.73,y:0.67},
    [LM.LEFT_THUMB]:      {x:0.29,y:0.66},
    [LM.RIGHT_THUMB]:     {x:0.71,y:0.66},
    [LM.LEFT_HIP]:        {x:0.40,y:0.62},
    [LM.RIGHT_HIP]:       {x:0.60,y:0.62},
    [LM.LEFT_KNEE]:       {x:0.38,y:0.77},
    [LM.RIGHT_KNEE]:      {x:0.62,y:0.77},
    [LM.LEFT_ANKLE]:      {x:0.38,y:0.90},
    [LM.RIGHT_ANKLE]:     {x:0.62,y:0.90},
    [LM.LEFT_HEEL]:       {x:0.37,y:0.93},
    [LM.RIGHT_HEEL]:      {x:0.63,y:0.93},
    [LM.LEFT_FOOT_INDEX]: {x:0.39,y:0.95},
    [LM.RIGHT_FOOT_INDEX]:{x:0.61,y:0.95},
  };
  return Object.assign({}, base, spec);
}

// Key landmarks per pose (subset used for accuracy + feedback)
// Full targets used for drawing

const DEFENSE_POSES = [
  {
    id: 'guard_stance',
    name: 'Guard Stance',
    description: 'Classic defensive guard — hands raised, chin tucked, weight balanced.',
    targets: buildTargets({
      [LM.LEFT_SHOULDER]:  {x:0.36,y:0.40},
      [LM.RIGHT_SHOULDER]: {x:0.64,y:0.40},
      [LM.LEFT_ELBOW]:     {x:0.30,y:0.50},
      [LM.RIGHT_ELBOW]:    {x:0.68,y:0.48},
      [LM.LEFT_WRIST]:     {x:0.34,y:0.34},
      [LM.RIGHT_WRIST]:    {x:0.64,y:0.30},
      [LM.LEFT_PINKY]:     {x:0.32,y:0.31},
      [LM.RIGHT_PINKY]:    {x:0.62,y:0.27},
      [LM.LEFT_INDEX]:     {x:0.33,y:0.30},
      [LM.RIGHT_INDEX]:    {x:0.63,y:0.27},
      [LM.LEFT_HIP]:       {x:0.40,y:0.62},
      [LM.RIGHT_HIP]:      {x:0.60,y:0.62},
      [LM.LEFT_KNEE]:      {x:0.38,y:0.77},
      [LM.RIGHT_KNEE]:     {x:0.62,y:0.77},
      [LM.LEFT_ANKLE]:     {x:0.37,y:0.91},
      [LM.RIGHT_ANKLE]:    {x:0.63,y:0.91},
    }),
    keyLandmarks: [LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_ELBOW, LM.RIGHT_ELBOW,
                   LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
    feedback: {
      [LM.LEFT_WRIST]:  {low:'Raise your left hand to guard level', high:'Lower your left hand slightly', left:'Move left hand inward', right:'Extend left hand outward'},
      [LM.RIGHT_WRIST]: {low:'Raise your right hand to guard level', high:'Lower your right hand slightly', left:'Move right hand outward', right:'Bring right hand inward'},
      [LM.LEFT_ELBOW]:  {low:'Lift your left elbow', high:'Drop your left elbow down'},
      [LM.RIGHT_ELBOW]: {low:'Lift your right elbow', high:'Drop your right elbow'},
    }
  },
  {
    id: 'palm_block',
    name: 'Palm Block',
    description: 'Deflect an incoming strike with an open palm — arm fully extended.',
    targets: buildTargets({
      [LM.LEFT_SHOULDER]:  {x:0.36,y:0.42},
      [LM.RIGHT_SHOULDER]: {x:0.64,y:0.42},
      [LM.LEFT_ELBOW]:     {x:0.30,y:0.52},
      [LM.RIGHT_ELBOW]:    {x:0.64,y:0.42},
      [LM.LEFT_WRIST]:     {x:0.42,y:0.48},
      [LM.RIGHT_WRIST]:    {x:0.68,y:0.26},
      [LM.RIGHT_PINKY]:    {x:0.70,y:0.22},
      [LM.RIGHT_INDEX]:    {x:0.71,y:0.22},
      [LM.LEFT_HIP]:       {x:0.42,y:0.62},
      [LM.RIGHT_HIP]:      {x:0.58,y:0.62},
    }),
    keyLandmarks: [LM.RIGHT_WRIST, LM.RIGHT_ELBOW, LM.LEFT_WRIST],
    feedback: {
      [LM.RIGHT_WRIST]: {low:'Extend your block higher — target face level', high:'Lower the block to nose level', left:'Push your block arm further out', right:'Bring block arm toward center'},
      [LM.LEFT_WRIST]:  {low:'Keep your left hand up as a secondary guard', high:'Lower your guard hand slightly'},
    }
  },
  {
    id: 'wrist_escape',
    name: 'Wrist Escape',
    description: 'Rotate and pull to break free from a wrist grab — pivot sharply.',
    targets: buildTargets({
      [LM.LEFT_SHOULDER]:  {x:0.36,y:0.42},
      [LM.RIGHT_SHOULDER]: {x:0.64,y:0.42},
      [LM.LEFT_ELBOW]:     {x:0.28,y:0.47},
      [LM.RIGHT_ELBOW]:    {x:0.66,y:0.50},
      [LM.LEFT_WRIST]:     {x:0.22,y:0.57},
      [LM.RIGHT_WRIST]:    {x:0.62,y:0.42},
      [LM.LEFT_PINKY]:     {x:0.20,y:0.60},
      [LM.LEFT_INDEX]:     {x:0.21,y:0.59},
      [LM.LEFT_HIP]:       {x:0.40,y:0.62},
      [LM.RIGHT_HIP]:      {x:0.60,y:0.62},
    }),
    keyLandmarks: [LM.LEFT_WRIST, LM.LEFT_ELBOW, LM.RIGHT_WRIST],
    feedback: {
      [LM.LEFT_WRIST]:  {low:'Pull left wrist sharply upward to escape', high:'Drive left wrist down and outward', right:'Pull your left wrist further outward'},
      [LM.RIGHT_WRIST]: {low:'Keep right hand up to protect your face', high:'Lower your guard slightly'},
    }
  },
  {
    id: 'low_guard',
    name: 'Low Guard',
    description: 'Protect against body and leg attacks — hands dropped to hip level.',
    targets: buildTargets({
      [LM.LEFT_SHOULDER]:  {x:0.36,y:0.40},
      [LM.RIGHT_SHOULDER]: {x:0.64,y:0.40},
      [LM.LEFT_ELBOW]:     {x:0.28,y:0.50},
      [LM.RIGHT_ELBOW]:    {x:0.70,y:0.50},
      [LM.LEFT_WRIST]:     {x:0.32,y:0.60},
      [LM.RIGHT_WRIST]:    {x:0.68,y:0.58},
      [LM.LEFT_PINKY]:     {x:0.30,y:0.64},
      [LM.RIGHT_PINKY]:    {x:0.70,y:0.62},
      [LM.LEFT_HIP]:       {x:0.40,y:0.62},
      [LM.RIGHT_HIP]:      {x:0.60,y:0.62},
      [LM.LEFT_KNEE]:      {x:0.36,y:0.76},
      [LM.RIGHT_KNEE]:     {x:0.64,y:0.76},
    }),
    keyLandmarks: [LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_ELBOW, LM.RIGHT_ELBOW],
    feedback: {
      [LM.LEFT_WRIST]:  {low:'Lower your left hand to protect hips and body', high:'Don\'t drop hands too low — keep control'},
      [LM.RIGHT_WRIST]: {low:'Drop your right hand to hip-guard level', high:'Right hand is too low'},
    }
  }
];

const ATTACK_POSES = [
  {
    id: 'straight_jab',
    name: 'Straight Jab',
    description: 'Quick lead-hand punch — arm fully extended, shoulder behind the strike.',
    targets: buildTargets({
      [LM.LEFT_SHOULDER]:  {x:0.36,y:0.42},
      [LM.RIGHT_SHOULDER]: {x:0.64,y:0.40},
      [LM.LEFT_ELBOW]:     {x:0.30,y:0.50},
      [LM.RIGHT_ELBOW]:    {x:0.66,y:0.40},
      [LM.LEFT_WRIST]:     {x:0.40,y:0.43},
      [LM.RIGHT_WRIST]:    {x:0.76,y:0.28},
      [LM.RIGHT_PINKY]:    {x:0.78,y:0.26},
      [LM.RIGHT_INDEX]:    {x:0.78,y:0.26},
      [LM.LEFT_HIP]:       {x:0.41,y:0.62},
      [LM.RIGHT_HIP]:      {x:0.59,y:0.62},
      [LM.LEFT_ANKLE]:     {x:0.36,y:0.91},
      [LM.RIGHT_ANKLE]:    {x:0.64,y:0.91},
    }),
    keyLandmarks: [LM.RIGHT_WRIST, LM.RIGHT_ELBOW, LM.LEFT_WRIST],
    feedback: {
      [LM.RIGHT_WRIST]: {low:'Drop your jab — aim for face level', high:'Extend jab upward toward target', left:'Punch further forward', right:'Angle jab more toward center'},
      [LM.LEFT_WRIST]:  {low:'Keep rear guard hand protecting your face', high:'Your guard is too high — lower slightly'},
    }
  },
  {
    id: 'palm_strike',
    name: 'Palm Strike',
    description: 'Drive the heel of your open palm upward into the attacker\'s nose.',
    targets: buildTargets({
      [LM.LEFT_SHOULDER]:  {x:0.36,y:0.42},
      [LM.RIGHT_SHOULDER]: {x:0.64,y:0.42},
      [LM.LEFT_ELBOW]:     {x:0.30,y:0.50},
      [LM.RIGHT_ELBOW]:    {x:0.62,y:0.40},
      [LM.LEFT_WRIST]:     {x:0.36,y:0.46},
      [LM.RIGHT_WRIST]:    {x:0.67,y:0.24},
      [LM.RIGHT_PINKY]:    {x:0.65,y:0.21},
      [LM.RIGHT_INDEX]:    {x:0.68,y:0.20},
      [LM.RIGHT_THUMB]:    {x:0.63,y:0.23},
    }),
    keyLandmarks: [LM.RIGHT_WRIST, LM.RIGHT_ELBOW],
    feedback: {
      [LM.RIGHT_WRIST]: {low:'Drive your palm strike higher — target the nose', high:'You\'re over-extending — aim at nose level', left:'Extend the strike further forward', right:'Bring the strike inward toward center'},
      [LM.RIGHT_ELBOW]: {low:'Straighten your elbow to fully extend the strike'},
    }
  },
  {
    id: 'knee_strike',
    name: 'Knee Strike',
    description: 'Drive your knee upward into the attacker\'s midsection — pull their head down simultaneously.',
    targets: buildTargets({
      [LM.LEFT_SHOULDER]:  {x:0.36,y:0.38},
      [LM.RIGHT_SHOULDER]: {x:0.64,y:0.38},
      [LM.LEFT_ELBOW]:     {x:0.28,y:0.44},
      [LM.RIGHT_ELBOW]:    {x:0.70,y:0.44},
      [LM.LEFT_WRIST]:     {x:0.34,y:0.30},
      [LM.RIGHT_WRIST]:    {x:0.66,y:0.28},
      [LM.LEFT_HIP]:       {x:0.40,y:0.60},
      [LM.RIGHT_HIP]:      {x:0.60,y:0.60},
      [LM.LEFT_KNEE]:      {x:0.38,y:0.84},
      [LM.RIGHT_KNEE]:     {x:0.60,y:0.53},
      [LM.LEFT_ANKLE]:     {x:0.38,y:0.93},
      [LM.RIGHT_ANKLE]:    {x:0.62,y:0.80},
    }),
    keyLandmarks: [LM.RIGHT_KNEE, LM.LEFT_WRIST, LM.RIGHT_WRIST],
    feedback: {
      [LM.RIGHT_KNEE]:  {low:'Drive your knee higher — aim for the midsection', high:'Good height — keep knee driving forward', left:'Knee is drifting out — drive it toward center', right:'Knee should cross your center line'},
      [LM.LEFT_WRIST]:  {low:'Pull the attacker\'s head down with both hands', high:'Your hands are too high — grip and pull down'},
      [LM.RIGHT_WRIST]: {low:'Use both hands to control the attacker — pull down'},
    }
  },
  {
    id: 'elbow_strike',
    name: 'Elbow Strike',
    description: 'Horizontal elbow smash at close range — rotate from the hip.',
    targets: buildTargets({
      [LM.LEFT_SHOULDER]:  {x:0.36,y:0.42},
      [LM.RIGHT_SHOULDER]: {x:0.64,y:0.42},
      [LM.LEFT_ELBOW]:     {x:0.28,y:0.50},
      [LM.RIGHT_ELBOW]:    {x:0.74,y:0.37},
      [LM.LEFT_WRIST]:     {x:0.34,y:0.44},
      [LM.RIGHT_WRIST]:    {x:0.57,y:0.36},
      [LM.RIGHT_PINKY]:    {x:0.56,y:0.34},
      [LM.RIGHT_INDEX]:    {x:0.55,y:0.33},
    }),
    keyLandmarks: [LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.RIGHT_SHOULDER],
    feedback: {
      [LM.RIGHT_ELBOW]: {low:'Raise your elbow to shoulder height', high:'Drop elbow to shoulder level — don\'t over-raise', left:'Drive your elbow further outward', right:'Swing elbow more to your right'},
      [LM.RIGHT_WRIST]: {low:'Bring your forearm across your body', high:'Your forearm is too high'},
    }
  }
];
