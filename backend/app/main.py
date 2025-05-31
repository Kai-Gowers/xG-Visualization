from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import joblib
import numpy as np
from pydantic import BaseModel


app = FastAPI()

# Allow frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the model
model = joblib.load("app/xg_modelv2.pkl")

class Position(BaseModel):
    x: float
    y: float

class InputPayload(BaseModel):
    striker: Position
    defenders: list[Position]

@app.post("/predict")
def predict(payload: InputPayload):
   sx, sy = payload.striker.x, payload.striker.y
   defenders = [(d.x, d.y) for d in payload.defenders]
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
    
    
   goalkeeper = (1180, 400)
   defenders.append(goalkeeper) 
   
   features = {
   "distance_to_goal": distance_to_goal(sx, sy) / 10,
   "angle_to_goal": angle_to_goal(sx, sy),
   "num_defenders_in_path": defenders_in_cone(sx, sy, defenders),
   "closest_defender_distance": closest_defender(sx, sy, defenders) / 10,
   
   "shot_body_part_Head": 0,
   "shot_body_part_Left Foot": 0,
   "shot_body_part_Other": 0,
   "shot_body_part_Right Foot": 1,
   "shot_body_part_nan": 0,

   "shot_type_Backheel": 0,
   "shot_type_Diving Header": 0,
   "shot_type_Half Volley": 0,
   "shot_type_Lob": 0,
   "shot_type_Normal": 1,
   "shot_type_Overhead Kick": 0,
   "shot_type_Volley": 0,
   "shot_type_nan": 0
   }
   
   print(features)

   X = np.array([list(features.values())])
   prob = model.predict_proba(X)[0][1]
   return {"xg": float(prob)}
