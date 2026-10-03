"""Directly traced silhouette correction on selected wide source pixels."""
from common import ART,read,write
from PIL import Image

trace={
 'moonlit':{
  'south-pylon':([718,666],[[710,586],[715,584],[714,575],[718,569],[720,580],[724,586],[729,589],[732,627],[736,641],[743,650],[739,662],[730,669],[715,672],[704,665],[697,654],[699,640],[703,621],[707,590]]),
  'west-pylon':([182,389],[[174,321],[178,319],[179,308],[184,317],[187,322],[190,349],[195,369],[203,382],[195,391],[171,393],[161,385],[166,361],[171,329]]),
  'east-pylon':([1199,366],[[1190,296],[1195,291],[1197,281],[1201,292],[1207,296],[1210,330],[1219,357],[1214,368],[1194,372],[1181,364],[1183,350],[1187,319]])},
 'verdigris':{
  'southwest-pylon':([216,638],[[220,554],[223,570],[225,597],[228,615],[233,625],[231,638],[214,644],[196,640],[196,626],[201,596],[205,578],[211,567],[217,562]]),
  'southeast-pylon':([1165,634],[[1159,542],[1171,559],[1180,579],[1180,610],[1183,629],[1175,636],[1150,638],[1142,632],[1146,606],[1149,580],[1155,561]])},
 'rust-sand':{
  'southwest-pylon':([197,610],[[184,486],[191,484],[199,493],[198,509],[200,516],[204,521],[205,543],[211,569],[213,584],[220,598],[213,608],[196,613],[184,610],[178,603],[180,587],[171,588],[177,571],[166,579],[154,582],[160,568],[168,552],[169,537],[177,525],[180,511]]),
  'southeast-pylon':([1173,684],[[1167,558],[1176,554],[1181,561],[1179,584],[1183,597],[1184,613],[1188,644],[1192,666],[1196,679],[1189,684],[1172,687],[1161,680],[1158,672],[1152,678],[1147,675],[1150,648],[1154,622],[1158,603],[1164,597]])}}
plan=read(ART/'waves/A12/occluders.json')
plan['authority']='authored direct silhouette traces on SELECTED WIDE source, not automatically mapped concept outlines; base measured at stone/cloth foot; small flame tip included'
for palette,rows in plan['palettes'].items():
    size=Image.open(ART/'review/sources'/f'a12-{palette}-wide-agy-a01.png').size
    for obj in rows:
        base,polygon=trace[palette][obj['id']]
        obj['sourceSizePx']=list(size);obj['baseSourcePx']=base;obj['polygonSourcePx']=polygon
        obj['baseUV']=[base[i]/size[i] for i in (0,1)]
        obj['polygonUV']=[[x/size[0],y/size[1]] for x,y in polygon]
write(ART/'waves/A12/occluders.json',plan)
