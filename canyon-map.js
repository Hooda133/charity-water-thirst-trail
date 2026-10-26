"use strict";
/* Thirst Trail 2.1 — interactive canyon field map. No external libraries. */
(() => {
  const init = () => {
    const sidebar = document.querySelector(".canyon-sidebar");
    const destinations = document.getElementById("canyonDestinations");
    if (!sidebar || !destinations || !window.TrailCanyon) return;
    const stops = [
      {x:165,y:270,name:"Surveyor",symbol:"1"},
      {x:305,y:455,name:"Seal kit",symbol:"2"},
      {x:390,y:165,name:"Valves",symbol:"3"},
      {x:700,y:365,name:"Aqueduct",symbol:"4"},
      {x:820,y:175,name:"Cistern",symbol:"5"},
      {x:290,y:520,name:"Rest shelter",symbol:"+"}
    ];
    const section = document.createElement("section");
    section.className = "canyon-map-panel";
    section.setAttribute("aria-label","Interactive Forgotten Canyon map");
    const heading=document.createElement("div");
    heading.className="canyon-map-heading";
    const title=document.createElement("strong");title.textContent="🧭 LIVE CANYON MAP";
    const legend=document.createElement("small");legend.textContent="● You  ·  ✓ Completed";
    heading.append(title,legend);
    const map=document.createElement("canvas");
    map.width=500;map.height=305;
    map.tabIndex=0;
    map.setAttribute("role","img");
    map.setAttribute("aria-label","Canyon map showing your position and six numbered destinations. Click a marker to navigate, or use destination buttons below.");
    const status=document.createElement("p");
    status.className="canyon-map-status";
    status.setAttribute("aria-live","off");
    status.textContent="Select a marker to follow its trail";
    section.append(heading,map,status);
    sidebar.insertBefore(section,destinations);
    const style=document.createElement("style");
    style.textContent=`
      .canyon-map-panel{margin:14px 0;padding:12px;background:#092d39;border:1px solid #85b7a766;border-radius:13px;color:#eaf6e9}
      .canyon-map-heading{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
      .canyon-map-heading strong{font-size:11px;letter-spacing:1px}
      .canyon-map-heading small{font-size:9px;color:#abd8cb}
      .canyon-map-panel canvas{display:block;width:100%;height:auto;margin-top:9px;border-radius:9px;cursor:crosshair;background:#c7875e;outline-offset:3px}
      .canyon-map-panel canvas:focus-visible{outline:3px solid #ffdb83}
      .canyon-map-status{font-size:10px;margin:8px 0 0;color:#b6d9d2}
    `;
    document.head.append(style);
    const ctx=map.getContext("2d");
    if(!ctx)return;
    const scaleX=map.width/1000,scaleY=map.height/610;
    function route(index){
      const buttons=destinations.querySelectorAll("button");
      if(buttons[index] && !buttons[index].disabled){
        buttons[index].click();
        status.textContent="Following trail to "+stops[index].name;
      }
    }
    function choose(event){
      const rect=map.getBoundingClientRect();
      const x=(event.clientX-rect.left)/rect.width*1000;
      const y=(event.clientY-rect.top)/rect.height*610;
      let index=-1,distance=70;
      stops.forEach((stop,i)=>{
        const gap=Math.hypot(x-stop.x,y-stop.y);
        if(gap<distance){distance=gap;index=i;}
      });
      if(index>=0)route(index);
      else status.textContent="Select a numbered mission marker to navigate";
    }
    map.addEventListener("click",choose);
    map.addEventListener("keydown",event=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        // Space belongs to this focused map control; the chapter's global
        // interact shortcut must not open a nearby objective and cancel travel.
        event.stopPropagation();
        const done=new Set(window.TrailCanyon.snapshot().done);
        const next=stops.findIndex((s,i)=>i===5||!done.has(["surveyor","kit","valves","span","cistern"][i]));
        route(Math.max(0,next));
      }
    });
    const X=x=>x*scaleX,Y=y=>y*scaleY;
    function draw(){
      const data=window.TrailCanyon.snapshot();
      if(!document.getElementById("canyonScreen")?.hidden){
        const w=map.width,h=map.height;
        const ground=ctx.createLinearGradient(0,0,w,h);
        ground.addColorStop(0,"#e3a974");ground.addColorStop(.55,"#bd7958");ground.addColorStop(1,"#874f49");
        ctx.fillStyle=ground;ctx.fillRect(0,0,w,h);
        // Mesa contour bands and winding canyon-floor trails.
        for(let k=0;k<7;k++){
          ctx.beginPath();ctx.strokeStyle="rgba(89,49,42,.18)";ctx.lineWidth=5;
          const y=k*52-15;
          ctx.moveTo(0,y+12);
          ctx.bezierCurveTo(w*.25,y-23,w*.6,y+35,w,y-8);
          ctx.stroke();
        }
        ctx.fillStyle="#512f39";ctx.fillRect(X(459),0,X(99),Y(316));
        ctx.fillRect(X(459),Y(392),X(99),h-Y(392));
        ctx.fillStyle="#86c4c5";ctx.fillRect(X(492),0,X(30),Y(316));
        ctx.fillRect(X(492),Y(392),X(30),h-Y(392));
        ctx.fillStyle="#f2d9ac";ctx.fillRect(X(450),Y(330),X(117),Y(43));
        ctx.setLineDash([5,6]);ctx.strokeStyle="#ffe2aa";ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(X(165),Y(270));ctx.lineTo(X(305),Y(455));
        ctx.lineTo(X(390),Y(165));ctx.moveTo(X(445),Y(350));
        ctx.lineTo(X(570),Y(350));ctx.lineTo(X(700),Y(365));ctx.lineTo(X(820),Y(175));ctx.stroke();ctx.setLineDash([]);
        stops.forEach((stop,i)=>{
          const done=data.done.includes(["surveyor","kit","valves","span","cistern"][i]);
          const x=X(stop.x),y=Y(stop.y);
          ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);
          ctx.fillStyle=done?"#398e77":i===5?"#8addc0":"#f8d583";ctx.fill();
          ctx.lineWidth=2;ctx.strokeStyle="#283d41";ctx.stroke();
          ctx.fillStyle="#17343b";ctx.textAlign="center";ctx.textBaseline="middle";
          ctx.font="bold 12px sans-serif";ctx.fillText(done?"✓":stop.symbol,x,y);
        });
        ctx.beginPath();ctx.arc(X(data.x),Y(data.y),7,0,Math.PI*2);
        ctx.fillStyle="#ffffff";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle="#197c9a";ctx.stroke();
        ctx.beginPath();ctx.arc(X(data.x),Y(data.y),13,0,Math.PI*2);ctx.strokeStyle="#ffffff99";ctx.lineWidth=1.5;ctx.stroke();
        status.dataset.position=Math.round(data.x)+","+Math.round(data.y);
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
