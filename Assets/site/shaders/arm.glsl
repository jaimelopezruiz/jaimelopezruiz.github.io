
precision highp float;
uniform float uRaw; uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform float uFog; uniform float uK;
uniform vec3 uJ[7]; uniform vec3 uA[5]; uniform sampler2D uTex;
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.); return length(pa-ba*h)-r; }
float sdDrum(vec3 p, vec3 c, vec3 ax, float r, float hl){ vec3 q=p-c; float h=dot(q,ax); float rad=length(q-ax*h); vec2 d=abs(vec2(rad,h))-vec2(r,hl); return min(max(d.x,d.y),0.)+length(max(d,0.)); }
vec2 map(vec3 p){
  float d=p.y; float id=4.;
  float b=sdBox(p-vec3(0.,0.15,0.),vec3(2.6,0.15,2.6));
  b=min(b,sdBox(p-vec3(0.,0.45,0.),vec3(2.0,0.15,2.0)));
  b=min(b,sdBox(p-vec3(0.,0.75,0.),vec3(1.4,0.15,1.4)));
  if(b<d){d=b;id=3.;}
  float a=1e3;
  for(int i=0;i<6;i++){ a=min(a, sdCap(p,uJ[i],uJ[i+1],0.62-0.085*float(i))); }
  if(a<d){d=a;id=1.;}
  float dr=1e3;
  for(int i=0;i<5;i++){ dr=min(dr, sdDrum(p,uJ[i+1],uA[i],0.78-0.09*float(i),0.42-0.04*float(i))); }
  if(dr<d){d=dr;id=2.;}
  float tp=length(p-uJ[6])-0.16; if(tp<d){d=tp;id=5.;}
  return vec2(d,id);
}
vec3 nrm(vec3 p){ vec2 e=vec2(0.003,0.); return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x, map(p+e.yxy).x-map(p-e.yxy).x, map(p+e.yyx).x-map(p-e.yyx).x)); }
float spot(vec3 p, vec3 o, vec3 dir, float w){ vec3 v=normalize(p-o); return smoothstep(w,1.,dot(v,dir)); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float bayer2(vec2 a){ a=floor(a); return fract(dot(a,vec2(0.5,a.y*0.75))); }
float bayer4(vec2 a){ return bayer2(0.5*a)*0.25+bayer2(a); }
vec4 groundTex(vec3 p){
  vec2 rob=vec2(p.x/uK, -p.z/uK);
  vec2 uv=(rob+0.55)/1.1;
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) return vec4(0.18,0.,0.,0.);
  return texture2D(uTex, uv);
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  uv.x-=0.05;
  float ang=-0.55+0.18*sin(uT*0.05);
  vec3 ta=vec3(3.0,2.0,0.);
  vec3 ro=ta+vec3(12.5*cos(ang), 6.8, 12.5*sin(ang));
  vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0.,1.,0.))), vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu+uv.y*vv+1.45*ww);
  vec3 lo=ta+vec3(9.*cos(ang+0.9),-0.5,9.*sin(ang+0.9));
  vec3 aim=ta+uu*(uM.x-0.5)*14.+vec3(0.,(uM.y-0.4)*8.,0.);
  vec3 ld=normalize(aim-lo);
  vec3 s1o=vec3(-16.,0.,-10.), s1d=normalize(vec3(0.3*sin(uT*0.31),1.,0.2));
  vec3 s2o=vec3(18.,0.,-14.), s2d=normalize(vec3(-0.3+0.25*sin(uT*0.23+2.),1.,0.25));
  float t=0.; vec2 h=vec2(0.); bool hit=false;
  for(int i=0;i<120;i++){
    h=map(ro+rd*t);
    if(h.x<0.002*t){hit=true;break;}
    t+=h.x*0.8;
    if(t>70.) break;
  }
  float L=0.05+0.22*exp(-abs(rd.y+0.08)*5.)*uFog;
  float acc=0.;
  if(hit){
    vec3 p=ro+rd*t; vec3 n=nrm(p);
    vec3 l=normalize(lo-p);
    float sp=spot(p,lo,ld,0.9);
    float dif=max(dot(n,l),0.)*sp*2.;
    float top=max(dot(n,normalize(vec3(0.3,1.,0.2))),0.);
    float rim=pow(max(dot(n,normalize(vec3(-0.5,0.6,0.7))),0.),2.)*0.3;
    float occ=clamp(map(p+n*0.3).x/0.3,0.,1.);
    float base=0.42;
    if(h.y==4.){ vec4 g=groundTex(p); base=g.r*1.1; acc=g.g; }
    if(h.y==3.) base=0.3;
    L=base*(0.25+0.75*occ)*(0.35+0.45*top)+dif*base*1.6+rim*occ;
    if(h.y==5.) acc=1.;
    float fogk=1.-exp(-t*0.022*uFog);
    L=mix(L,0.15,fogk);
  }
  float tmax=hit?t:45.;
  float vol=0., pil=0.;
  vec3 tip=uJ[6];
  for(int i=0;i<24;i++){
    float s=(float(i)+hash(gl_FragCoord.xy+uT))/24.*tmax;
    vec3 q=ro+rd*s;
    float hf=exp(-max(q.y,0.)*0.15);
    vol+=(spot(q,lo,ld,0.985)*1.1+spot(q,s1o,s1d,0.995)*0.7+spot(q,s2o,s2d,0.995)*0.7)*hf;
    float dxz=length(q.xz-tip.xz);
    pil+=step(q.y,tip.y)*exp(-dxz*dxz*40.);
  }
  L+=vol/24.*tmax*0.045*uFog;
  acc=max(acc, clamp(pil/24.*tmax*0.9,0.,1.));
  L=pow(clamp(L,0.,1.),0.8);
  L+=(hash(gl_FragCoord.xy*1.7)-0.5)*0.06;
  float v=clamp(L,0.,1.)*3.; float b=floor(v);
  float lev=min(3., b+step(bayer4(gl_FragCoord.xy), v-b));
  vec3 c0=vec3(0.039,0.039,0.043), c1=vec3(0.17,0.165,0.155), c2=vec3(0.45,0.43,0.40), c3=vec3(0.88,0.86,0.81);
  vec3 col = lev<0.5?c0:(lev<1.5?c1:(lev<2.5?c2:c3));
  if(uRaw>0.5) col=mix(c0,c3,clamp(L,0.,1.));
  if(acc>0.08){ col = (uRaw>0.5 ? acc>0.3 : step(bayer4(gl_FragCoord.xy), acc*1.2)>0.5) ? vec3(0.91,0.63,0.23) : col; }
  gl_FragColor=vec4(col,1.);
}