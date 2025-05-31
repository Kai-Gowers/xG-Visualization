from fastapi import FastAPI, Request
import joblib
from app.utils import calculate_distance, calculate_angle
import numpy as np


app = FastAPI()
model = joblib.load("app/xg_modelv2.pkl")


@app.post("/predict_xg")
async def predict_xg(data: dict):
   x = data.get("x")
   y = data.get("y")


   distance = calculate_distance(x, y)
   angle = calculate_angle(x, y)


   features = np.array([[distance, angle, 0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,1,1,0]])
   xg = model.predict_proba(features)[0][1]


   #return {"xG": .5}
   return {"xG": round(float(xg), 4)}


from fastapi.middleware.cors import CORSMiddleware

from fastapi.middleware.cors import CORSMiddleware


app.add_middleware(
   CORSMiddleware,
   allow_origins=["http://localhost:3000"],
   allow_credentials=True,
   allow_methods=["*"],
   allow_headers=["*"],
)



