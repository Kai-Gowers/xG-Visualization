"""Pitch geometry constants and categorical vocabularies.

Everything is in StatsBomb units: the pitch is 120 long by 80 wide, the attacking
team shoots toward x = 120, the goal centre is (120, 40) and the posts are at
y = 36 and y = 44. One unit is roughly 0.9 m.
"""

PITCH_LENGTH = 120.0
PITCH_WIDTH = 80.0
GOAL_X = 120.0
GOAL_CENTRE_Y = 40.0
POST_LOW_Y = 36.0
POST_HIGH_Y = 44.0
GOAL_WIDTH = POST_HIGH_Y - POST_LOW_Y
GOAL_CENTRE = (GOAL_X, GOAL_CENTRE_Y)
POST_LOW = (GOAL_X, POST_LOW_Y)
POST_HIGH = (GOAL_X, POST_HIGH_Y)

# Where a goalkeeper is assumed to stand when none is visible in the freeze frame.
GK_IMPUTE = (118.0, 40.0)

# Effective blocking radii (half an arm span): 80 cm for outfielders, 160 cm for keepers.
DEFENDER_RADIUS = 0.4375
GK_RADIUS = 0.875
# A defender within this distance of the shooter is "pressuring".
PRESSURE_RADIUS = 3.0
# Distance used for "closest defender" when there is none.
DIST_CAP = 30.0
# Shooter x is clamped below the goal line so angle/cone geometry stays defined.
X_CLAMP_MAX = 119.5
# A keeper standing on the line still occludes the goal.
GK_X_CLAMP_MAX = 119.9

MAX_PLAYERS_PER_SIDE = 22

BODY_PARTS = ("Right Foot", "Left Foot", "Head", "Other")
TECHNIQUES = (
    "Normal",
    "Volley",
    "Half Volley",
    "Lob",
    "Backheel",
    "Overhead Kick",
    "Diving Header",
)
# Penalties are predicted by a fixed rule, so they are not part of the model vocabulary.
SHOT_TYPES = ("Open Play", "Free Kick", "Corner")
PENALTY = "Penalty"
ALL_SHOT_TYPES = (*SHOT_TYPES, PENALTY)
# StatsBomb "Kick Off" shots are treated as open play.
SHOT_TYPE_MAP = {"Kick Off": "Open Play"}

PLAY_PATTERNS = (
    "Regular Play",
    "From Corner",
    "From Free Kick",
    "From Throw In",
    "From Counter",
    "Other",
)
PLAY_PATTERN_MAP = {
    "From Keeper": "Other",
    "From Goal Kick": "Other",
    "From Kick Off": "Other",
}

PREFERRED_FEET = ("Right", "Left", "Unknown")
FOOT_BODY_PARTS = {"Right Foot": "Right", "Left Foot": "Left"}
