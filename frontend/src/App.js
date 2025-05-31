import React, { useState } from 'react';
import axios from 'axios';
import './App.css';


function App() {
 const [xg, setXG] = useState(null);
 const [clickCoords, setClickCoords] = useState(null);


 const handleClick = async (e) => {
   const pitch = e.target.getBoundingClientRect();
   const clickX = e.clientX - pitch.left;
   const clickY = e.clientY - pitch.top;


   // Convert to 120x80 StatsBomb scale
   const scaledX = (clickX / pitch.width) * 120;
   const scaledY = (clickY / pitch.height) * 80;


   setClickCoords({ x: scaledX.toFixed(2), y: scaledY.toFixed(2) });


   try {
     const res = await axios.post("http://localhost:8000/predict_xg", {
       x: scaledX,
       y: scaledY,
     });
     setXG(res.data.xG);
   } catch (err) {
     console.error("API error:", err);
   }
 };


 return (
   <div className="App">
     <h2>xG Prediction Tool</h2>
     <div className="pitch" onClick={handleClick}>
       Click on the pitch to simulate a shot
     </div>
     {clickCoords && (
       <p>
         Shot at ({clickCoords.x}, {clickCoords.y}) → xG: {xg ?? "Loading..."}
       </p>
     )}
   </div>
 );
}


export default App;



