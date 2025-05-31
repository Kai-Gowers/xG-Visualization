import React, { useState } from "react";
import "./App.css";

function App() {
  const [striker, setStriker] = useState({ x: 600, y: 400 });
  const [defenders, setDefenders] = useState([]);
  const [dragging, setDragging] = useState(null); // { type: 'striker' | 'defender-template' | 'defender', index }
  const [goalkeeper, setGoalkeeper] = useState({ x: 1180, y: 400 }); // StatsBomb: (118, 40) scaled 10x


  const handleDrop = (e) => {
    const pitch = document.querySelector(".pitch");
    const rect = pitch.getBoundingClientRect();
    const x = e.clientX - rect.left - 14;
    const y = e.clientY - rect.top - 14;

    if (!dragging) return;

    if (dragging.type === "striker") {
      setStriker({ x, y });
    } else if (dragging.type === "defender-template") {
      setDefenders([...defenders, { x, y }]);
    } else if (dragging.type === "defender") {
      const updated = [...defenders];
      updated[dragging.index] = { x, y };
      setDefenders(updated);
    }

    setDragging(null);
  };

  const [xg, setXg] = useState(null)

  const handlePredict = async () => {
    const payload = {
      striker: striker,
      defenders: defenders
    };
    const response = await fetch("http://localhost:8000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json()
    setXg(data.xg.toFixed(3))

  }


  return (
    <div>
      <h2 style={{ textAlign: "center", color: "black" }}>xG Prediction Tool</h2>

      <div
        className="pitch"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Field */}
        <div className="halfway-line" />
        <div className="center-circle" />
        <div className="goal left-goal" />
        <div className="goal right-goal" />
        <div className="box six-yard-box left" />
        <div className="box eighteen-yard-box left" />
        <div className="box six-yard-box right" />
        <div className="box eighteen-yard-box right" />

        {/* Striker */}
        <div
          className="player striker"
          style={{ left: striker.x, top: striker.y }}
          draggable
          onDragStart={() => setDragging({ type: "striker" })}
        >
          S
        </div>

        {/* Defenders */}
        {defenders.map((d, idx) => (
          <div
            key={idx}
            className="player defender"
            style={{ left: d.x, top: d.y }}
            draggable
            onDragStart={() => setDragging({ type: "defender", index: idx })}
          >
            D
          </div>
        ))}

        <div
          className="player goalkeeper"
          style={{ left: goalkeeper.x, top: goalkeeper.y }}
        >
          GK
        </div>

        {/* Sidebar template */}
        <div className="sidebar">
          <div
            className="player defender"
            draggable
            onDragStart={() => setDragging({ type: "defender-template" })}
          >
            D
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: "20px"}}>
          <button onClick={() => {
            setDefenders([]);
            setStriker({x: 600, y: 400})
          }}>
            Reset Pitch
          </button>
        </div>
        <div style={{textAlign: "center", marginTop:"10px"}}>
          <button onClick={handlePredict}>Get xG</button>
          {xg !== null && (
            <div style={{ marginTop: "10px", color: "white", fontSize: "20px" }}>
              Predicted xG: <strong>{xg}</strong>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
