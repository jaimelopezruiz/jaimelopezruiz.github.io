
precision highp float;
uniform float uRaw; uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform float uFog; uniform float uShot; uniform float uShift;
const float PHIMAX = 15.708; const float B = 0.085; const float R0 = 3.6; const float H = 0.30;
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
float spiral(vec3 p){
  float r=length(p.xz); float a=atan(p.z,p.x); if(a<0.) a+=6.28318;
  float best=1e3;
  for(int k=0;k<3;k++){
    float phi=a+6.28318*float(k);
    if(phi<=PHIMAX){
      float e=exp(-B*phi);
      vec2 q=vec2(r-R0*e, p.y-H*phi);
      vec2 hw=vec2(0.62*e+0.1, 0.2*e+0.06);
      vec2 dd=abs(q)-hw;
      best=min(best, length(max(dd,0.))+min(max(dd.x,dd.y),0.));
    }
  }
  return best;
}
float thread(vec3 p, float ins){
  float r=length(p.xz); float a=atan(p.z,p.x); if(a<0.) a+=6.28318;
  float best=1e3;
  for(int k=0;k<3;k++){
    float phi=a+6.28318*float(k);
    if(phi<=ins){
      float e=exp(-B*phi);
      vec2 q=vec2(r-R0*e, p.y-(H*phi+0.2*e+0.06+0.06));
      best=min(best, length(q)-0.085);
    }
  }
  return best;
}
float modiolus(vec3 p){
  float h=clamp((p.y+1.0)/6.2,0.,1.);
  float rad=mix(1.25,0.25,h);
  float a=atan(p.z,p.x); float fin=0.06*smoothstep(0.6,1.,abs(cos(a*8.)));
  float d=length(p.xz)-rad-fin;
  return max(d, max(-1.2-p.y, p.y-4.75))*0.8;
}
float plinth(vec3 p){
  float d=sdBox(p-vec3(0.,-1.75,0.), vec3(6.2,0.45,6.2));
  d=min(d, sdBox(p-vec3(0.,-1.05,0.), vec3(4.9,0.3,4.9)));
  d=min(d, sdBox(p-vec3(0.,-0.55,0.), vec3(3.9,0.22,3.9)));
  return d;
}
float INS;
vec2 map(vec3 p){
  float d=spiral(p); float id=1.;
  float m=modiolus(p); if(m<d){d=m;id=2.;}
  float b=plinth(p); if(b<d){d=b;id=3.;}
  float g=p.y+2.2; if(g<d){d=g;id=4.;}
  float t=thread(p,INS); if(t<d){d=t;id=5.;}
  return vec2(d,id);
}
vec3 nrm(vec3 p){ vec2 e=vec2(0.003,0.); return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x, map(p+e.yxy).x-map(p-e.yxy).x, map(p+e.yyx).x-map(p-e.yyx).x)); }
float spot(vec3 p, vec3 o, vec3 dir, float w){ vec3 v=normalize(p-o); return smoothstep(w,1.,dot(v,dir)); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float bayer2(vec2 a){ a=floor(a); return fract(dot(a,vec2(0.5,a.y*0.75))); }
float bayer4(vec2 a){ return bayer2(0.5*a)*0.25+bayer2(a); }
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  uv.x+=uShift;
  float ang=uT*0.035; vec3 ro; vec3 ta; float fl;
  if(uShot<0.5){ ro=vec3(14.5*sin(ang), 7.2, 14.5*cos(ang)); ta=vec3(0.,1.6,0.); fl=1.35; }
  else if(uShot<1.5){ float a2=ang*2.5+1.; ro=vec3(2.05*sin(a2), -0.05, 2.05*cos(a2)); ta=vec3(-0.9*sin(a2+0.6), 5.5, -0.9*cos(a2+0.6)); fl=0.85; }
  else { ro=vec3(30.*sin(ang+2.), -1.4, 30.*cos(ang+2.)); ta=vec3(0.,2.4,0.); fl=2.1; }
  vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0.,1.,0.))), vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu+uv.y*vv+fl*ww);
  INS = (0.5+0.5*sin(uT*0.22-1.2))*9.4;
  vec3 lo=vec3(10.*sin(ang+0.6),-1.6,10.*cos(ang+0.6));
  vec3 aim=vec3((uM.x-0.5)*12.*cos(ang),(uM.y-0.35)*6.,-(uM.x-0.5)*12.*sin(ang));
  vec3 ld=normalize(aim-lo);
  vec3 s1o=vec3(-14.,-2.2,-6.), s1d=normalize(vec3(0.35*sin(uT*0.31),1.,0.15));
  vec3 s2o=vec3(15.,-2.2,-9.), s2d=normalize(vec3(-0.3+0.25*sin(uT*0.23+2.),1.,0.1));
  float t=0.; vec2 h=vec2(0.); bool hit=false;
  for(int i=0;i<140;i++){
    h=map(ro+rd*t);
    if(h.x<0.002*t){hit=true;break;}
    t+=h.x*0.55;
    if(t>60.) break;
  }
  float L=0.05+(uShot>1.5?0.42:0.22)*exp(-abs(rd.y+0.12)*(uShot>1.5?2.5:5.))*uFog;
  float acc=0.;
  if(hit){
    vec3 p=ro+rd*t; vec3 n=nrm(p);
    vec3 l=normalize(lo-p);
    float sp=spot(p,lo,ld,0.9);
    float dif=max(dot(n,l),0.)*sp*2.2;
    float rim=pow(max(dot(n,normalize(vec3(-0.3,0.8,-0.6))),0.),2.)*0.32;
    float occ=clamp(map(p+n*0.25).x/0.25,0.,1.);
    float base=h.y==4. ? 0.12 : (h.y==3. ? 0.3 : 0.42);
    float sky=0.25+0.75*clamp(n.y*0.5+0.5,0.,1.);
    L=base*(0.3+0.7*occ)*sky*0.45+dif*base*1.8+rim*occ;
    if(h.y==5.){ acc=1.; }
    if(h.y==1.){
      vec3 rr=normalize(vec3(p.x,0.,p.z));
      if(abs(dot(n,rr))>0.6){
        float a=atan(p.z,p.x); if(a<0.) a+=6.28318;
        float phi=a; float bd=1e3;
        for(int k=0;k<3;k++){ float ph=a+6.28318*float(k); float dd=abs(p.y-H*ph); if(dd<bd){bd=dd;phi=ph;} }
        float e=exp(-B*phi);
        float s=phi*R0*e*5.;
        float vy=(p.y-H*phi)/(0.2*e+0.06);
        float cell=floor(s);
        float win=step(fract(s),0.42)*step(abs(vy),0.42);
        float lit=step(0.52,hash(vec2(cell,floor(vy*2.+5.)+sign(dot(n,rr)))));
        L+=win*(0.12+0.75*lit);
      }
    }
    if(h.y==2.){
      float a=atan(p.z,p.x);
      float slit=step(0.75,fract(a*8./6.28318+0.5))*step(fract(p.y*2.6),0.5);
      float lit=step(0.6,hash(vec2(floor(a*8./6.28318+0.5),floor(p.y*2.6))));
      L+=slit*lit*0.7;
    }
    float fogk=1.-exp(-t*0.03*uFog);
    L=mix(L,uShot>1.5?0.2:0.16,fogk);
  }
  float tmax=hit?t:(uShot>1.5?60.:40.);
  float vol=0.;
  for(int i=0;i<26;i++){
    float s=(float(i)+hash(gl_FragCoord.xy+uT))/26.*tmax;
    vec3 q=ro+rd*s;
    float hf=exp(-max(q.y+2.,0.)*0.18);
    vol+=(spot(q,lo,ld,0.985)*1.1+spot(q,s1o,s1d,0.995)*0.7+spot(q,s2o,s2d,0.995)*0.7)*hf;
  }
  L+=vol/26.*tmax*0.05*uFog;
  L=pow(clamp(L,0.,1.),0.8);
  L+= (hash(gl_FragCoord.xy*1.7)-0.5)*0.06;
  float v=clamp(L,0.,1.)*3.;
  float b=floor(v);
  float lev=min(3., b+step(bayer4(gl_FragCoord.xy), v-b));
  vec3 c0=vec3(0.039,0.039,0.043), c1=vec3(0.17,0.165,0.155), c2=vec3(0.45,0.43,0.40), c3=vec3(0.88,0.86,0.81);
  vec3 col = lev<0.5?c0:(lev<1.5?c1:(lev<2.5?c2:c3));
  if(uRaw>0.5) col=mix(c0,c3,clamp(L,0.,1.));
  if(acc>0.5){ col = (uRaw>0.5 || step(bayer4(gl_FragCoord.xy),0.85)>0.5) ? vec3(0.91,0.63,0.23) : vec3(0.42,0.26,0.07); }
  gl_FragColor=vec4(col,1.);
}