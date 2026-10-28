"use strict";
/* Visible supply interactions. The expedition controller owns rewards and saves. */
(() => {
  let serial=0;
  const REACH=140;
  function create(root,{caches=[],onCollect=()=>false,onTravel=()=>false}={}){
    if(!root)return Object.freeze({update(){},dispose(){}});
    const doc=root.ownerDocument||document,known=new Set();
    const supplies=caches.filter(cache=>cache&&typeof cache.id==="string"&&!known.has(cache.id)&&known.add(cache.id))
      .map(cache=>({...cache,label:cache.label||cache.name||"Water supply"}));
    const buttons=new Map(),badges=new Map();
    let state={active:false,paused:false,collected:new Set(),x:NaN,y:NaN},disposed=false;
    let previousKey="",complete=null;
    const element=(tag,className,text)=>{
      const node=doc.createElement(tag);node.className=className;
      if(text!==undefined)node.textContent=text;
      return node;
    };
    const titleId=(root.id||"supplyInteraction"+(++serial))+"Title";
    root.replaceChildren();root.hidden=true;root.classList.add("supply-dom-panel");
    root.setAttribute("aria-labelledby",titleId);
    const header=element("div","supply-dom-heading");
    const heading=element("div","supply-dom-title");
    heading.append(element("span","overline","SEALED WATER SUPPLIES"));
    const title=element("h3","","Water for the trail");title.id=titleId;heading.append(title);
    const counter=element("span","supply-dom-counter","0 / "+supplies.length);
    header.append(heading,counter);
    const description=element("p","supply-dom-description","Click a nearby drop to collect a sealed supply. Distant drops guide you there.");
    const board=element("div","supply-dom-board");board.setAttribute("role","group");board.setAttribute("aria-label","Sealed water supply drops");
    const collected=element("ul","supply-dom-collected");collected.setAttribute("aria-label","Collected sealed supplies");
    const completion=element("div","supply-dom-completion");
    const status=element("p","supply-dom-status","Each collected supply restores up to 12 energy and earns 25 impact.");
    status.setAttribute("role","status");status.setAttribute("aria-live","polite");status.setAttribute("aria-atomic","true");status.tabIndex=-1;
    root.append(header,description,board,collected,completion,status);
    function announce(text){if(status.textContent!==text)status.textContent=text;}
    function nearby(cache){return Number.isFinite(state.x)&&Number.isFinite(state.y)&&Math.hypot(state.x-cache.x,state.y-cache.y)<=REACH;}
    function makeButton(cache){
      const button=element("button","supply-dom-button");button.type="button";button.dataset.supplyId=cache.id;
      const drop=element("span","supply-dom-drop");drop.setAttribute("aria-hidden","true");
      drop.innerHTML='<svg viewBox="0 0 32 40" focusable="false"><path d="M16 2C12 10 3 17 3 25a13 13 0 0 0 26 0C29 17 20 10 16 2Z" fill="currentColor"/><path d="M10 22c-2 5 0 9 5 10" fill="none" stroke="#d6fff4" stroke-width="3" stroke-linecap="round"/></svg>';
      const copy=element("span","supply-dom-button-copy");
      const label=element("strong","",cache.label),action=element("small","","Walk to supply");copy.append(label,action);
      button.append(drop,copy);
      const activate=()=>{
        if(disposed||!state.active||state.paused||state.collected.has(cache.id))return;
        if(nearby(cache))onCollect(cache.id);
        else{
          const accepted=onTravel(cache.id);
          if(accepted!==false)announce("Follow the trail to "+cache.label+". Its drop disappears when the supply is collected.");
        }
      };
      button.addEventListener("click",activate);
      // Replay can restore only some drops; insert each new one in the original
      // order without moving or rebuilding the surviving buttons.
      const next=supplies.slice(supplies.indexOf(cache)+1).map(item=>buttons.get(item.id)).find(Boolean);
      if(next)board.insertBefore(button,next.button);else board.append(button);
      const entry={button,action,activate};buttons.set(cache.id,entry);return entry;
    }
    function update(snapshot={}){
      if(disposed)return;
      const ids=new Set(Array.isArray(snapshot.collected)?snapshot.collected.filter(id=>known.has(id)):[]);
      state={active:!!snapshot.active,paused:!!snapshot.paused,collected:ids,x:snapshot.x,y:snapshot.y};
      root.hidden=!state.active;
      let restoreFocus=false;
      for(const cache of supplies){
        const entry=buttons.get(cache.id);
        if(ids.has(cache.id)){
          if(entry){
            restoreFocus=restoreFocus||doc.activeElement===entry.button;
            entry.button.removeEventListener("click",entry.activate);entry.button.remove();buttons.delete(cache.id);
          }
          if(!badges.has(cache.id)){
            const badge=element("li","supply-dom-badge","✓ "+cache.label);badge.dataset.collectedSupply=cache.id;
            collected.append(badge);badges.set(cache.id,badge);
          }
        }else{
          if(badges.has(cache.id)){badges.get(cache.id).remove();badges.delete(cache.id);}
          const current=entry||makeButton(cache),ready=nearby(cache);
          current.button.disabled=!state.active||state.paused;
          current.button.classList.toggle("is-nearby",ready);
          const label=(ready?"Collect ":"Walk to ")+cache.label+" sealed water supply";
          if(current.button.getAttribute("aria-label")!==label){current.button.setAttribute("aria-label",label);current.button.title=label;}
          const action=ready?"Collect supply":"Walk to supply";
          if(current.action.textContent!==action)current.action.textContent=action;
        }
      }
      const total=ids.size,key=Number(state.active)+":"+Number(state.paused)+":"+supplies.filter(cache=>ids.has(cache.id)).map(cache=>cache.id).join(",");
      const count=total+" / "+supplies.length;if(counter.textContent!==count)counter.textContent=count;
      const countLabel=total+" of "+supplies.length+" sealed supplies collected";
      if(counter.getAttribute("aria-label")!==countLabel)counter.setAttribute("aria-label",countLabel);
      board.hidden=total===supplies.length;collected.hidden=total===0;
      if(total===supplies.length&&supplies.length){
        if(!complete){complete=element("p","supply-dom-complete","✓ All supplies collected. You’re ready for the trail!");complete.dataset.supplyComplete="true";completion.append(complete);}
      }else if(complete){complete.remove();complete=null;}
      if(key!==previousKey){
        if(state.paused)announce("Expedition paused. Resume to collect water supplies.");
        else if(total===supplies.length&&supplies.length)announce("All "+supplies.length+" sealed supplies collected. Your trail is clear!");
        else if(total)announce(total+" of "+supplies.length+" supplies collected. Keep exploring for the remaining drops.");
        else announce("Each collected supply restores up to 12 energy and earns 25 impact.");
        previousKey=key;
      }
      if(restoreFocus&&state.active){
        const next=supplies.map(cache=>buttons.get(cache.id)).find(entry=>entry&&!entry.button.disabled);
        (next?.button||status).focus({preventScroll:true});
      }
    }
    function dispose(){
      if(disposed)return;disposed=true;
      for(const entry of buttons.values())entry.button.removeEventListener("click",entry.activate);
      buttons.clear();badges.clear();root.replaceChildren();root.hidden=true;
    }
    update();return Object.freeze({update,dispose});
  }
  window.TrailSupplyUI=Object.freeze({create});
})();
