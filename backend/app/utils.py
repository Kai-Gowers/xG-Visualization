import numpy as np

def calculate_distance(x, y):
   return np.sqrt((120 - x)**2 + (40 - y)**2)


def calculate_angle(x, y):
   goal_y1, goal_y2 = 36, 44
   dx = 120 - x
   return abs(np.arctan2(goal_y2 - y, dx) - np.arctan2(goal_y1 - y, dx))





