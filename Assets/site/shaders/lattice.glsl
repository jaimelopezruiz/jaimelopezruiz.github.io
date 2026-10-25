precision highp float;
uniform float uRaw; uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform float uFog; uniform float uShot; uniform float uShift;
const float A = 1.7;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float hash3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
vec3 ION_O; vec3 ION_D;
float track(vec3 p){ vec3 q=p-ION_O; float h=max(dot(q,ION_D),0.); return length(q-ION_D*h); }
float DMG;
vec2 map(vec3 p){
  float block=sdBox(p-vec3(0.,-3.,0.), vec3(9.4,5.2,9.4));
  vec3 cell=floor(p/A+0.5);
  vec3 c=cell*A;
  float dl=track(c);
  float d=exp(-dl*dl*0.18)*step(c.y, ION_O.y);
  vec3 jit=(vec3(hash3(cell),hash3(cell+7.1),hash3(cell+3.3))-0.5)*1.5*d;
  vec3 q=p-c;
  float atom=length(q-jit)-0.44;
  float keep=1.-smoothstep(0.25,0.45,d);
  float bx=max(length(q.yz)-0.06, abs(q.x)-A*0.5);
  float by=max(length(q.xz)-0.06, abs(q.y)-A*0.5);
  float bz=max(length(q.xy)-0.06, abs(q.z)-A*0.5);
  float bond=min(bx,min(by,bz)); bond=mix(1e3,bond,keep);
  float lat=min(atom,bond);
  lat=max(lat, block);
  float plinth=sdBox(p-vec3(0.,-9.0,0.), vec3(11.5,0.8,11.5));
  plinth=min(plinth, sdBox(p-vec3(0.,-10.3,0.), vec3(13.5,0.6,13.5)));
  float g=p.y+10.9;
  vec2 res=vec2(lat,1.);
  DMG=d;
  if(plinth<res.x) res=vec2(plinth,3.);
  if(g<res.x) res=vec2(g,4.);
  return res;
}
vec3 nrm(vec3 p){ vec2 e=vec2(0.004,0.); return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x, map(p+e.yxy).x-map(p-e.yxy).x, map(p+e.yyx).x-map(p-e.yyx).x)); }
float spot(vec3 p, vec3 o, vec3 dir, float w){ vec3 v=normalize(p-o); return smoothstep(w,1.,dot(v,dir)); }
float bayer2(vec2 a){ a=floor(a); return fract(dot(a,vec2(0.5,a.y*0.75))); }
float bayer4(vec2 a){ return bayer2(0.5*a)*0.25+bayer2(a); }
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  uv.x+=uShift;
  float ang=0.75+uT*0.03;
  vec3 ta=vec3(0.,-3.2,0.);
  vec3 ro=ta+vec3(30.*sin(ang), 15.5, 30.*cos(ang));
  vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0.,1.,0.))), vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu+uv.y*vv+1.6*ww);
  float tt=mod(uT,14.);
  ION_O=vec3(-26.,22.,-9.)+vec3(0.,0.,0.);
  ION_D=normalize(vec3(1.,-0.95,0.42));
  vec3 lo=ta+vec3(22.*sin(ang+1.1),-4.,22.*cos(ang+1.1));
  vec3 aim=ta+uu*(uM.x-0.5)*20.+vec3(0.,(uM.y-0.45)*12.,0.);
  vec3 ld=normalize(aim-lo);
  float t=0.; vec2 h=vec2(0.); bool hit=false;
  for(int i=0;i<160;i++){
    h=map(ro+rd*t);
    if(h.x<0.002*t){hit=true;break;}
    t+=h.x*0.7;
    if(t>90.) break;
  }
  float L=0.05+0.22*exp(-abs(rd.y+0.12)*4.)*uFog;
  float acc=0.;
  if(hit){
    vec3 p=ro+rd*t; vec3 n=nrm(p);
    vec3 l=normalize(lo-p);
    float sp=spot(p,lo,ld,0.9);
    float dif=max(dot(n,l),0.)*sp*2.;
    float top=max(dot(n,normalize(vec3(0.2,1.,0.3))),0.);
    float rim=pow(max(dot(n,normalize(vec3(-0.5,0.6,-0.6))),0.),2.)*0.3;
    float base=h.y==4.?0.1:(h.y==3.?0.3:0.42);
    L=base*(0.3+0.45*top)+dif*base*1.6+rim;
    if(h.y==1. && DMG>0.35) acc=1.;
    float fogk=1.-exp(-t*0.02*uFog);
    L=mix(L,0.15,fogk);
  }
  float tmax=hit?t:70.;
  float vol=0., beam=0.;
  for(int i=0;i<24;i++){
    float s=(float(i)+hash(gl_FragCoord.xy+uT))/24.*tmax;
    vec3 q=ro+rd*s;
    vol+=spot(q,lo,ld,0.985)*exp(-max(q.y+10.,0.)*0.08);
    beam+=exp(-pow(track(q),2.)*6.)*step(-1.,q.y);
  }
  L+=vol/24.*tmax*0.03*uFog;
  acc=max(acc, clamp(beam/24.*tmax*0.25,0.,1.));
  L=pow(clamp(L,0.,1.),0.8);
  L+=(hash(gl_FragCoord.xy*1.7)-0.5)*0.06;
  float v=clamp(L,0.,1.)*3.; float b=floor(v);
  float lev=min(3., b+step(bayer4(gl_FragCoord.xy), v-b));
  vec3 c0=vec3(0.039,0.039,0.043), c1=vec3(0.17,0.165,0.155), c2=vec3(0.45,0.43,0.40), c3=vec3(0.88,0.86,0.81);
  vec3 col = lev<0.5?c0:(lev<1.5?c1:(lev<2.5?c2:c3));
  if(uRaw>0.5) col=mix(c0,c3,clamp(L,0.,1.));
  if(acc>0.08){ col = (uRaw>0.5 ? acc>0.3 : step(bayer4(gl_FragCoord.xy), acc*1.1)>0.5) ? vec3(0.91,0.63,0.23) : col; }
  gl_FragColor=vec4(col,1.);
}
