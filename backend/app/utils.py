import numpy as np

def distance_to_goal(x, y):
   return np.sqrt((1200 - x)**2 + (400 - y)**2)

def angle_to_goal(x, y):
   a1 = np.arctan2(360 - y, 1200 - x)
   a2 = np.arctan2(440 - y, 1200 - x)
   return abs(a2 - a1)

def defenders_in_cone(x, y, defenders):
   a1 = np.arctan2(360 - y, 1200 - x)
   a2 = np.arctan2(440 - y, 1200 - x)
   a_min, a_max = min(a1, a2), max(a1, a2)
   return sum(a_min <= np.arctan2(dy - y, dx - x) <= a_max for dx, dy in defenders)

def closest_defender(x, y, defenders):
   if not defenders:
      return 999
   return min(np.linalg.norm([dx - x, dy - y]) for dx, dy in defenders)