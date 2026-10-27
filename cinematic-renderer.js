"use strict";
/* Shared, locally authored rendering polish. No gameplay state or network assets. */
(() => {
  function create(THREE,{renderer,scene,camera,chapter="valley"}){
    const surfaces=window.ThirstSurfaces?.create(THREE,renderer)||null;
    const waterMaterials=new Set(),polished=new WeakSet(),waterClock={value:0},waterDetail={value:.18};
    let quality="high",effects=true,reduced=false,disposed=false,environment=null,environmentSource=null;
    let target=null,pass=null,passScene=null,passCamera=null,lastScan=-10,frameWidth=0,frameHeight=0;
    const oldEnvironment=scene.environment,oldIntensity=scene.environmentIntensity;
    // Soft sky reflections lift metals and wet stone without white mirror glare.
    try{
      const image=document.createElement("canvas");image.width=512;image.height=256;
      const c=image.getContext("2d");
      if(c){
        const sky=c.createLinearGradient(0,0,0,256);
        sky.addColorStop(0,chapter==="canyon"?"#527b9e":"#6cabc4");
        sky.addColorStop(.43,"#c6e0dc");sky.addColorStop(.55,"#ffdfb2");
        sky.addColorStop(.61,chapter==="canyon"?"#aa7c64":"#879a7a");sky.addColorStop(1,"#394d48");
        c.fillStyle=sky;c.fillRect(0,0,512,256);
        const glow=c.createRadialGradient(145,94,2,145,94,62);
        glow.addColorStop(0,"#fff8df");glow.addColorStop(.15,"#fff0cd");glow.addColorStop(1,"#fff0cd00");
        c.fillStyle=glow;c.fillRect(75,24,140,140);
        environmentSource=new THREE.CanvasTexture(image);environmentSource.colorSpace=THREE.SRGBColorSpace;
        environmentSource.mapping=THREE.EquirectangularReflectionMapping;
        const pmrem=new THREE.PMREMGenerator(renderer);
        environment=pmrem.fromEquirectangular(environmentSource);pmrem.dispose();
        scene.environment=environment.texture;scene.environmentIntensity=.55;
      }
    }catch(error){console.warn("Sky reflections unavailable; keeping direct scene lighting.",error);}
    const fabricCanvas=document.createElement("canvas");fabricCanvas.width=fabricCanvas.height=64;
    const fabricContext=fabricCanvas.getContext("2d");let fabric=null;
    if(fabricContext){
      fabricContext.fillStyle="#888";fabricContext.fillRect(0,0,64,64);
      for(let i=0;i<64;i+=2){fabricContext.fillStyle=i%4?"#a4a4a4":"#686868";fabricContext.fillRect(i,0,1,64);fabricContext.fillRect(0,i,64,1);}
      fabric=new THREE.CanvasTexture(fabricCanvas);fabric.wrapS=fabric.wrapT=THREE.RepeatWrapping;fabric.repeat.set(7,7);
    }
    function character(root){
      root?.traverse?.(node=>{
        if(!node.isMesh)return;
        surfaces?.projectUV(node.geometry,2);
        for(const m of Array.isArray(node.material)?node.material:[node.material]){
          if(!m||polished.has(m))continue;polished.add(m);
          m.dithering=true;m.envMapIntensity=.7;
          const hsl={};m.color?.getHSL(hsl);
          if(fabric&&m.roughness>=.7&&hsl.s>.22&&hsl.h>.30&&hsl.h<.72){m.bumpMap=fabric;m.bumpScale=.012;}
          m.needsUpdate=true;
        }
      });
    }
    function water(material){
      if(!material?.isMeshStandardMaterial||waterMaterials.has(material))return;
      waterMaterials.add(material);
      material.envMapIntensity=.65;material.roughness=Math.min(.32,material.roughness);
      material.metalness=Math.min(.12,material.metalness);material.dithering=true;
      const previous=material.onBeforeCompile;
      material.onBeforeCompile=shader=>{
        previous?.(shader,renderer);
        shader.uniforms.trailWaterTime=waterClock;shader.uniforms.trailWaterDetail=waterDetail;
        shader.vertexShader="varying vec3 vTrailWaterPosition;\n"+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace("#include <worldpos_vertex>",`#include <worldpos_vertex>
          vec4 trailPosition=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
          trailPosition=instanceMatrix*trailPosition;
          #endif
          vTrailWaterPosition=(modelMatrix*trailPosition).xyz;`);
        shader.fragmentShader="varying vec3 vTrailWaterPosition; uniform float trailWaterTime; uniform float trailWaterDetail;\n"+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
          vec2 wp=vTrailWaterPosition.xz;
          float wa=sin(wp.x*2.3+wp.y*.8+trailWaterTime*.75);
          float wb=cos(wp.y*3.1-wp.x*.55-trailWaterTime*.65);
          normal=normalize(normal+vec3(wa,wb,0.0)*trailWaterDetail);`);
        shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
          float current=sin(vTrailWaterPosition.x*1.8+sin(vTrailWaterPosition.z*1.3-trailWaterTime*.7));
          float caustic=pow(max(0.0,current),18.0)*.045;
          diffuseColor.rgb=diffuseColor.rgb*(.96+.045*current)+vec3(caustic*.65,caustic,caustic*.9);`);
      };
      material.customProgramCacheKey=()=>"trail-water-cinematic-v1";material.needsUpdate=true;
    }
    function scan(){
      scene.traverse(object=>{
        if(!object.isMesh)return;
        for(const m of Array.isArray(object.material)?object.material:[object.material]){
          if(!m?.isMeshStandardMaterial)continue;
          // Explicit names keep teal glass and supply bottles out of the water pass.
          if(/water|ocean|river/i.test(m.name||""))water(m);
        }
      });
    }
    function makePass(){
      if(target)return;
      const hdr=renderer.extensions.has("EXT_color_buffer_float");
      target=new THREE.WebGLRenderTarget(1,1,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:true,stencilBuffer:false});
      target.samples=Math.min(renderer.capabilities.maxSamples||4,quality==="ultra"?4:2);
      pass=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:true,
        uniforms:{tScene:{value:target.texture},resolution:{value:new THREE.Vector2(1,1)},
          warmth:{value:new THREE.Vector3(...(chapter==="canyon"?[1.025,1.005,.985]:chapter==="coast"?[1.005,1.018,1.025]:[1.015,1.018,.99]))}},
        vertexShader:"varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
        fragmentShader:`uniform sampler2D tScene;uniform vec2 resolution;uniform vec3 warmth;varying vec2 vUv;
          float trailLuma(vec3 c){return dot(c,vec3(.299,.587,.114));}
          void main(){
            vec2 px=1.0/resolution;
            vec3 nw=texture2D(tScene,vUv+vec2(-1.,-1.)*px).rgb,ne=texture2D(tScene,vUv+vec2(1.,-1.)*px).rgb;
            vec3 sw=texture2D(tScene,vUv+vec2(-1.,1.)*px).rgb,se=texture2D(tScene,vUv+vec2(1.,1.)*px).rgb;
            vec3 center=texture2D(tScene,vUv).rgb;
            float lnw=trailLuma(nw),lne=trailLuma(ne),lsw=trailLuma(sw),lse=trailLuma(se),lm=trailLuma(center);
            float lmin=min(lm,min(min(lnw,lne),min(lsw,lse))),lmax=max(lm,max(max(lnw,lne),max(lsw,lse)));
            vec2 dir=vec2(-((lnw+lne)-(lsw+lse)),(lnw+lsw)-(lne+lse));
            float reduce=max((lnw+lne+lsw+lse)*.0078125,.0078125);
            dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-8.),vec2(8.))*px;
            vec3 a=.5*(texture2D(tScene,vUv+dir*(-.1666667)).rgb+texture2D(tScene,vUv+dir*.1666667).rgb);
            vec3 b=a*.5+.25*(texture2D(tScene,vUv-dir*.5).rgb+texture2D(tScene,vUv+dir*.5).rgb);
            float lb=trailLuma(b);vec3 color=(lb<lmin||lb>lmax)?a:b;
            if(lmax-lmin<max(.03,lmax*.08))color=center;
            vec3 highlights=max((nw+ne+sw+se)*.25-vec3(1.1),vec3(0.));color+=highlights*.025;
            color*=warmth;float edge=smoothstep(.27,.72,length(vUv-.5));color*=1.-edge*.075;
            gl_FragColor=vec4(max(color,vec3(0.)),1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
            gl_FragColor.rgb+=grain/510.;
          }`});
      passScene=new THREE.Scene();passCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      passScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),pass));
    }
    function configure(profile={}){
      quality=["low","medium","high","ultra"].includes(profile.preset)?profile.preset:quality;
      effects=profile.effects!==false;surfaces?.quality(quality,effects);
      if(target){
        const samples=Math.min(renderer.capabilities.maxSamples||4,quality==="ultra"?4:2);
        if(target.samples!==samples){target.samples=samples;target.dispose();}
      }
      waterDetail.value=quality==="low"?.075:quality==="medium"?.12:.18;
    }
    function update(time,options={}){
      reduced=!!options.reduced;if(options.effects!==undefined)effects=!!options.effects;
      waterClock.value=effects&&!reduced&&Number.isFinite(time)?time:0;
      surfaces?.update(time,effects&&!reduced);
      scene.environmentIntensity=(quality==="low"?.43:.56)*(1-(Number(options.night)||0)*.60);
      if(time-lastScan>.8||lastScan<0){scan();lastScan=time;}
    }
    function render(){
      if((quality!=="high"&&quality!=="ultra")||!effects){renderer.setRenderTarget(null);renderer.render(scene,camera);return;}
      makePass();
      const size=renderer.getDrawingBufferSize(new THREE.Vector2());
      if(size.x!==frameWidth||size.y!==frameHeight){target.setSize(size.x,size.y);pass.uniforms.resolution.value.copy(size);frameWidth=size.x;frameHeight=size.y;}
      renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
      renderer.setRenderTarget(null);renderer.render(passScene,passCamera);
    }
    function dispose(){
      if(disposed)return;disposed=true;surfaces?.dispose();fabric?.dispose();
      environment?.dispose();environmentSource?.dispose();
      if(scene.environment===environment?.texture){scene.environment=oldEnvironment;scene.environmentIntensity=oldIntensity;}
      target?.dispose();pass?.dispose();for(const child of passScene?.children||[])child.geometry?.dispose();waterMaterials.clear();
    }
    return {surfaces,character,water,scan,configure,update,render,dispose,status:()=>({quality,pbr:surfaces?.status?.()||null,
      waterMaterials:waterMaterials.size,skyReflections:!!environment,postFX:effects&&(quality==="high"||quality==="ultra")})};
  }
  window.TrailCinematic=Object.freeze({create});
})();
