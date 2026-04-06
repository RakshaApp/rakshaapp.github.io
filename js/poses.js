// Pose targets are now stored as offsets relative to body measurements.
// Units:
//   x: multiples of half-shoulder-width  (positive = toward right shoulder)
//   y: multiples of torso-height         (positive = downward)
// Origin: midpoint between the two shoulders.
//
// At runtime these are converted to absolute pixel positions using the
// user's own detected landmarks, so they scale to any body size / camera distance.
//
// Body reference measurements (computed from detected landmarks each frame):
//   shoulder_mid   = midpoint of LEFT_SHOULDER and RIGHT_SHOULDER
//   half_sw        = half the distance between shoulders  (x unit)
//   torso_h        = distance from shoulder_mid to hip_mid (y unit)

const ACCURACY_THRESHOLD = 68;
const HOLD_DURATION_MS = 5000;

// Helper: build a full 33-landmark map from a simplified spec
function buildTargets(spec) {
    // spec: { [lmIndex]: {x,y} }
    // we fill gaps with sensible neutral defaults if not specified
    const base = {
        [LM.NOSE]: { x: 0.5, y: 0.18 },
        [LM.LEFT_EYE_INNER]: { x: 0.46, y: 0.16 },
        [LM.LEFT_EYE]: { x: 0.44, y: 0.16 },
        [LM.LEFT_EYE_OUTER]: { x: 0.42, y: 0.16 },
        [LM.RIGHT_EYE_INNER]: { x: 0.54, y: 0.16 },
        [LM.RIGHT_EYE]: { x: 0.56, y: 0.16 },
        [LM.RIGHT_EYE_OUTER]: { x: 0.58, y: 0.16 },
        [LM.LEFT_EAR]: { x: 0.4, y: 0.18 },
        [LM.RIGHT_EAR]: { x: 0.6, y: 0.18 },
        [LM.MOUTH_LEFT]: { x: 0.46, y: 0.22 },
        [LM.MOUTH_RIGHT]: { x: 0.54, y: 0.22 },
        [LM.LEFT_SHOULDER]: { x: 0.36, y: 0.4 },
        [LM.RIGHT_SHOULDER]: { x: 0.64, y: 0.4 },
        [LM.LEFT_ELBOW]: { x: 0.3, y: 0.52 },
        [LM.RIGHT_ELBOW]: { x: 0.7, y: 0.52 },
        [LM.LEFT_WRIST]: { x: 0.28, y: 0.64 },
        [LM.RIGHT_WRIST]: { x: 0.72, y: 0.64 },
        [LM.LEFT_PINKY]: { x: 0.26, y: 0.68 },
        [LM.RIGHT_PINKY]: { x: 0.74, y: 0.68 },
        [LM.LEFT_INDEX]: { x: 0.27, y: 0.67 },
        [LM.RIGHT_INDEX]: { x: 0.73, y: 0.67 },
        [LM.LEFT_THUMB]: { x: 0.29, y: 0.66 },
        [LM.RIGHT_THUMB]: { x: 0.71, y: 0.66 },
        [LM.LEFT_HIP]: { x: 0.4, y: 0.62 },
        [LM.RIGHT_HIP]: { x: 0.6, y: 0.62 },
        [LM.LEFT_KNEE]: { x: 0.38, y: 0.77 },
        [LM.RIGHT_KNEE]: { x: 0.62, y: 0.77 },
        [LM.LEFT_ANKLE]: { x: 0.38, y: 0.9 },
        [LM.RIGHT_ANKLE]: { x: 0.62, y: 0.9 },
        [LM.LEFT_HEEL]: { x: 0.37, y: 0.93 },
        [LM.RIGHT_HEEL]: { x: 0.63, y: 0.93 },
        [LM.LEFT_FOOT_INDEX]: { x: 0.39, y: 0.95 },
        [LM.RIGHT_FOOT_INDEX]: { x: 0.61, y: 0.95 },
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
        // rx: multiples of half-shoulder-width from shoulder midpoint
        // ry: multiples of torso-height downward from shoulder midpoint (negative = above)
        targets: {
            [LM.LEFT_WRIST]: { rx: -0.9, ry: -0.55 },
            [LM.RIGHT_WRIST]: { rx: 1.1, ry: -0.65 },
            [LM.LEFT_ELBOW]: { rx: -1.1, ry: -0.15 },
            [LM.RIGHT_ELBOW]: { rx: 1.0, ry: -0.2 },
            [LM.LEFT_SHOULDER]: { rx: -1.0, ry: 0.0 },
            [LM.RIGHT_SHOULDER]: { rx: 1.0, ry: 0.0 },
            [LM.LEFT_HIP]: { rx: -0.8, ry: 1.0 },
            [LM.RIGHT_HIP]: { rx: 0.8, ry: 1.0 },
            [LM.LEFT_KNEE]: { rx: -0.8, ry: 1.9 },
            [LM.RIGHT_KNEE]: { rx: 0.8, ry: 1.9 },
            [LM.LEFT_ANKLE]: { rx: -0.8, ry: 2.8 },
            [LM.RIGHT_ANKLE]: { rx: 0.8, ry: 2.8 },
            [LM.NOSE]: { rx: 0.0, ry: -0.85 },
        },
        keyLandmarks: [
            LM.LEFT_WRIST,
            LM.RIGHT_WRIST,
            LM.LEFT_ELBOW,
            LM.RIGHT_ELBOW,
            LM.LEFT_SHOULDER,
            LM.RIGHT_SHOULDER,
        ],
        feedback: {
            [LM.LEFT_WRIST]: {
                low: 'Raise your left hand to guard level',
                high: 'Lower your left hand slightly',
                left: 'Move left hand inward',
                right: 'Extend left hand outward',
            },
            [LM.RIGHT_WRIST]: {
                low: 'Raise your right hand to guard level',
                high: 'Lower your right hand slightly',
                left: 'Move right hand outward',
                right: 'Bring right hand inward',
            },
            [LM.LEFT_ELBOW]: { low: 'Lift your left elbow', high: 'Drop your left elbow down' },
            [LM.RIGHT_ELBOW]: { low: 'Lift your right elbow', high: 'Drop your right elbow' },
        },
    },
    {
        id: 'palm_block',
        name: 'Palm Block',
        description: 'Deflect an incoming strike with an open palm — arm fully extended.',
        targets: {
            [LM.LEFT_SHOULDER]: { rx: -1.0, ry: 0.0 },
            [LM.RIGHT_SHOULDER]: { rx: 1.0, ry: 0.0 },
            [LM.LEFT_ELBOW]: { rx: -1.1, ry: -0.1 },
            [LM.RIGHT_ELBOW]: { rx: 0.9, ry: -0.05 },
            [LM.LEFT_WRIST]: { rx: -0.7, ry: -0.1 },
            [LM.RIGHT_WRIST]: { rx: 1.3, ry: -0.75 },
            [LM.LEFT_HIP]: { rx: -0.8, ry: 1.0 },
            [LM.RIGHT_HIP]: { rx: 0.8, ry: 1.0 },
            [LM.LEFT_KNEE]: { rx: -0.8, ry: 1.9 },
            [LM.RIGHT_KNEE]: { rx: 0.8, ry: 1.9 },
            [LM.LEFT_ANKLE]: { rx: -0.8, ry: 2.8 },
            [LM.RIGHT_ANKLE]: { rx: 0.8, ry: 2.8 },
            [LM.NOSE]: { rx: 0.0, ry: -0.85 },
        },
        keyLandmarks: [LM.RIGHT_WRIST, LM.RIGHT_ELBOW, LM.LEFT_WRIST],
        feedback: {
            [LM.RIGHT_WRIST]: {
                low: 'Extend your block higher — target face level',
                high: 'Lower the block to nose level',
                left: 'Push your block arm further out',
                right: 'Bring block arm toward center',
            },
            [LM.LEFT_WRIST]: {
                low: 'Keep your left hand up as a secondary guard',
                high: 'Lower your guard hand slightly',
            },
        },
    },
    {
        id: 'wrist_escape',
        name: 'Wrist Escape',
        description: 'Rotate and pull to break free from a wrist grab.',
        targets: {
            [LM.LEFT_SHOULDER]: { rx: -1.0, ry: 0.0 },
            [LM.RIGHT_SHOULDER]: { rx: 1.0, ry: 0.0 },
            [LM.LEFT_ELBOW]: { rx: -1.4, ry: 0.05 },
            [LM.RIGHT_ELBOW]: { rx: 0.9, ry: 0.1 },
            [LM.LEFT_WRIST]: { rx: -1.8, ry: 0.35 },
            [LM.RIGHT_WRIST]: { rx: 0.9, ry: -0.1 },
            [LM.LEFT_HIP]: { rx: -0.8, ry: 1.0 },
            [LM.RIGHT_HIP]: { rx: 0.8, ry: 1.0 },
            [LM.LEFT_KNEE]: { rx: -0.8, ry: 1.9 },
            [LM.RIGHT_KNEE]: { rx: 0.8, ry: 1.9 },
            [LM.LEFT_ANKLE]: { rx: -0.8, ry: 2.8 },
            [LM.RIGHT_ANKLE]: { rx: 0.8, ry: 2.8 },
            [LM.NOSE]: { rx: 0.0, ry: -0.85 },
        },
        keyLandmarks: [LM.LEFT_WRIST, LM.LEFT_ELBOW, LM.RIGHT_WRIST],
        feedback: {
            [LM.LEFT_WRIST]: {
                low: 'Pull left wrist sharply upward to escape',
                high: 'Drive left wrist down and outward',
                right: 'Pull your left wrist further outward',
            },
            [LM.RIGHT_WRIST]: { low: 'Keep right hand up to protect your face' },
        },
    },
    {
        id: 'low_guard',
        name: 'Low Guard',
        description: 'Protect against body and leg attacks — hands at hip level.',
        targets: {
            [LM.LEFT_SHOULDER]: { rx: -1.0, ry: 0.0 },
            [LM.RIGHT_SHOULDER]: { rx: 1.0, ry: 0.0 },
            [LM.LEFT_ELBOW]: { rx: -1.3, ry: 0.15 },
            [LM.RIGHT_ELBOW]: { rx: 1.3, ry: 0.15 },
            [LM.LEFT_WRIST]: { rx: -1.1, ry: 0.6 },
            [LM.RIGHT_WRIST]: { rx: 1.1, ry: 0.6 },
            [LM.LEFT_HIP]: { rx: -0.8, ry: 1.0 },
            [LM.RIGHT_HIP]: { rx: 0.8, ry: 1.0 },
            [LM.LEFT_KNEE]: { rx: -0.9, ry: 1.85 },
            [LM.RIGHT_KNEE]: { rx: 0.9, ry: 1.85 },
            [LM.LEFT_ANKLE]: { rx: -0.9, ry: 2.8 },
            [LM.RIGHT_ANKLE]: { rx: 0.9, ry: 2.8 },
            [LM.NOSE]: { rx: 0.0, ry: -0.85 },
        },
        keyLandmarks: [LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_ELBOW, LM.RIGHT_ELBOW],
        feedback: {
            [LM.LEFT_WRIST]: { low: 'Lower your left hand to hip-guard level', high: "Don't drop hands too low" },
            [LM.RIGHT_WRIST]: { low: 'Drop your right hand to hip-guard level', high: 'Right hand is too low' },
        },
    },
];

const ATTACK_POSES = [
    {
        id: 'straight_jab',
        name: 'Straight Jab',
        description: 'Quick lead-hand punch — arm fully extended, shoulder behind the strike.',
        targets: {
            [LM.LEFT_SHOULDER]: { rx: -1.0, ry: 0.0 },
            [LM.RIGHT_SHOULDER]: { rx: 1.0, ry: 0.0 },
            [LM.LEFT_ELBOW]: { rx: -1.1, ry: 0.1 },
            [LM.RIGHT_ELBOW]: { rx: 0.8, ry: -0.05 },
            [LM.LEFT_WRIST]: { rx: -0.8, ry: 0.05 },
            [LM.RIGHT_WRIST]: { rx: 1.7, ry: -0.6 },
            [LM.LEFT_HIP]: { rx: -0.8, ry: 1.0 },
            [LM.RIGHT_HIP]: { rx: 0.8, ry: 1.0 },
            [LM.LEFT_KNEE]: { rx: -0.9, ry: 1.9 },
            [LM.RIGHT_KNEE]: { rx: 0.9, ry: 1.9 },
            [LM.LEFT_ANKLE]: { rx: -0.9, ry: 2.8 },
            [LM.RIGHT_ANKLE]: { rx: 0.9, ry: 2.8 },
            [LM.NOSE]: { rx: 0.0, ry: -0.85 },
        },
        keyLandmarks: [LM.RIGHT_WRIST, LM.RIGHT_ELBOW, LM.LEFT_WRIST],
        feedback: {
            [LM.RIGHT_WRIST]: {
                low: 'Drop your jab — aim for face level',
                high: 'Extend jab upward toward target',
                left: 'Punch further forward',
                right: 'Angle jab more toward center',
            },
            [LM.LEFT_WRIST]: { low: 'Keep rear guard hand protecting your face' },
        },
    },
    {
        id: 'palm_strike',
        name: 'Palm Strike',
        description: "Drive the heel of your open palm upward into the attacker's nose.",
        targets: {
            [LM.LEFT_SHOULDER]: { rx: -1.0, ry: 0.0 },
            [LM.RIGHT_SHOULDER]: { rx: 1.0, ry: 0.0 },
            [LM.LEFT_ELBOW]: { rx: -1.1, ry: 0.1 },
            [LM.RIGHT_ELBOW]: { rx: 0.7, ry: -0.1 },
            [LM.LEFT_WRIST]: { rx: -0.9, ry: -0.05 },
            [LM.RIGHT_WRIST]: { rx: 1.1, ry: -0.8 },
            [LM.LEFT_HIP]: { rx: -0.8, ry: 1.0 },
            [LM.RIGHT_HIP]: { rx: 0.8, ry: 1.0 },
            [LM.LEFT_KNEE]: { rx: -0.8, ry: 1.9 },
            [LM.RIGHT_KNEE]: { rx: 0.8, ry: 1.9 },
            [LM.LEFT_ANKLE]: { rx: -0.8, ry: 2.8 },
            [LM.RIGHT_ANKLE]: { rx: 0.8, ry: 2.8 },
            [LM.NOSE]: { rx: 0.0, ry: -0.85 },
        },
        keyLandmarks: [LM.RIGHT_WRIST, LM.RIGHT_ELBOW],
        feedback: {
            [LM.RIGHT_WRIST]: {
                low: 'Drive your palm strike higher — target the nose',
                high: 'Over-extending — aim at nose level',
                left: 'Extend the strike further forward',
                right: 'Bring the strike inward toward center',
            },
            [LM.RIGHT_ELBOW]: { low: 'Straighten your elbow to fully extend the strike' },
        },
    },
    {
        id: 'knee_strike',
        name: 'Knee Strike',
        description: "Drive your knee up into the attacker's midsection.",
        targets: {
            [LM.LEFT_SHOULDER]: { rx: -1.0, ry: 0.0 },
            [LM.RIGHT_SHOULDER]: { rx: 1.0, ry: 0.0 },
            [LM.LEFT_ELBOW]: { rx: -1.3, ry: -0.3 },
            [LM.RIGHT_ELBOW]: { rx: 1.3, ry: -0.3 },
            [LM.LEFT_WRIST]: { rx: -1.0, ry: -0.65 },
            [LM.RIGHT_WRIST]: { rx: 1.0, ry: -0.65 },
            [LM.LEFT_HIP]: { rx: -0.8, ry: 1.0 },
            [LM.RIGHT_HIP]: { rx: 0.8, ry: 1.0 },
            [LM.LEFT_KNEE]: { rx: -0.8, ry: 2.0 },
            [LM.RIGHT_KNEE]: { rx: 0.4, ry: 0.55 },
            [LM.LEFT_ANKLE]: { rx: -0.8, ry: 2.9 },
            [LM.RIGHT_ANKLE]: { rx: 0.8, ry: 1.85 },
            [LM.NOSE]: { rx: 0.0, ry: -0.85 },
        },
        keyLandmarks: [LM.RIGHT_KNEE, LM.LEFT_WRIST, LM.RIGHT_WRIST],
        feedback: {
            [LM.RIGHT_KNEE]: {
                low: 'Drive your knee higher — aim for the midsection',
                high: 'Good height — keep driving forward',
                left: 'Knee drifting out — drive toward center',
            },
            [LM.LEFT_WRIST]: { low: "Pull the attacker's head down with both hands" },
            [LM.RIGHT_WRIST]: { low: 'Use both hands to control the attacker — pull down' },
        },
    },
    {
        id: 'elbow_strike',
        name: 'Elbow Strike',
        description: 'Horizontal elbow smash at close range — rotate from the hip.',
        targets: {
            [LM.LEFT_SHOULDER]: { rx: -1.0, ry: 0.0 },
            [LM.RIGHT_SHOULDER]: { rx: 1.0, ry: 0.0 },
            [LM.LEFT_ELBOW]: { rx: -1.2, ry: 0.1 },
            [LM.RIGHT_ELBOW]: { rx: 1.6, ry: -0.1 },
            [LM.LEFT_WRIST]: { rx: -1.0, ry: 0.05 },
            [LM.RIGHT_WRIST]: { rx: 0.7, ry: -0.05 },
            [LM.LEFT_HIP]: { rx: -0.8, ry: 1.0 },
            [LM.RIGHT_HIP]: { rx: 0.8, ry: 1.0 },
            [LM.LEFT_KNEE]: { rx: -0.8, ry: 1.9 },
            [LM.RIGHT_KNEE]: { rx: 0.8, ry: 1.9 },
            [LM.LEFT_ANKLE]: { rx: -0.8, ry: 2.8 },
            [LM.RIGHT_ANKLE]: { rx: 0.8, ry: 2.8 },
            [LM.NOSE]: { rx: 0.0, ry: -0.85 },
        },
        keyLandmarks: [LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.RIGHT_SHOULDER],
        feedback: {
            [LM.RIGHT_ELBOW]: {
                low: 'Raise your elbow to shoulder height',
                high: 'Drop elbow to shoulder level',
                left: 'Drive your elbow further outward',
                right: 'Swing elbow more to your right',
            },
            [LM.RIGHT_WRIST]: { low: 'Bring your forearm across your body' },
        },
    },
];
