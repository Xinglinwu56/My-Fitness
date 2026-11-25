
import React, { useEffect, useState } from "react";
import {
  SafeAreaView, View, Text, TextInput, Pressable, ScrollView,
  Image, Alert, StyleSheet, Platform
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";

const dbPromise = SQLite.openDatabaseAsync("myfitness.db");
const copyToPrivateStorage = async (uri, index) => {
  const dir = FileSystem.documentDirectory + "bodycheck/";
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const ext = (uri.split(".").pop() || "jpg").split("?")[0];
  const dest = `${dir}${Date.now()}_${index}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
};

const emptyMetrics = {
  weight: "", bodyFat: "", muscle: "", bmi: "", ffmi: "",
  trunkLean: "", rightArmLean: "", leftArmLean: "", rightLegLean: "", leftLegLean: "",
  trunkFat: "", rightArmFat: "", leftArmFat: "", rightLegFat: "", leftLegFat: ""
};

export default function App() {
  const [lang, setLang] = useState("zh");
  const [screen, setScreen] = useState("home");
  const [photos, setPhotos] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [records, setRecords] = useState([]);
  const [ready, setReady] = useState(false);

  const zh = lang === "zh";
  const t = (a,b) => zh ? a : b;

  useEffect(() => {
    (async () => {
      const db = await dbPromise;
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS measurements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          photos TEXT NOT NULL,
          metrics TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      await loadRecords();
      setReady(true);
    })().catch(e => Alert.alert("Database", String(e)));
  }, []);

  const loadRecords = async () => {
    const db = await dbPromise;
    const rows = await db.getAllAsync("SELECT * FROM measurements ORDER BY date DESC, id DESC");
    setRecords(rows.map(r => ({...r, metrics: JSON.parse(r.metrics), photos: JSON.parse(r.photos)})));
  };

  const choosePhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("需要允许访问照片","Photo access required"), t("请在系统设置中允许访问照片。","Allow photo access in system settings."));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 3,
      quality: 1
    });
    if (!result.canceled) {
      const selected = result.assets.slice(0,3).map(a => a.uri);
      setPhotos(selected);
      if (selected.length !== 3) {
        Alert.alert(t("照片数量","Photo count"), t("一次测量建议选择完整的三张报告照片。","Please select all three report photos for one measurement."));
      }
    }
  };

  const saveRecord = async () => {
    if (!date.trim()) return Alert.alert(t("缺少日期","Missing date"), t("请填写测量日期。","Enter the measurement date."));
    if (photos.length !== 3) return Alert.alert(t("照片不完整","Photos incomplete"), t("请先选择三张照片。","Select all three photos first."));
    try {
      const privatePhotos = [];
      for (let i=0; i<photos.length; i++) privatePhotos.push(await copyToPrivateStorage(photos[i], i));
      const db = await dbPromise;
      await db.runAsync(
        "INSERT INTO measurements (date, photos, metrics, created_at) VALUES (?, ?, ?, ?)",
        date.trim(), JSON.stringify(privatePhotos), JSON.stringify(metrics), new Date().toISOString()
      );
      setPhotos([]); setMetrics(emptyMetrics); setDate(new Date().toISOString().slice(0,10));
      await loadRecords(); setScreen("home");
      Alert.alert(t("已保存","Saved"), t("测量记录已保存在本机。","Measurement saved on this device."));
    } catch (e) {
      Alert.alert(t("保存失败","Save failed"), String(e));
    }
  };

  const field = (key, label) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={metrics[key]}
        onChangeText={v => setMetrics(old => ({...old, [key]: v}))}
        placeholder="—"
      />
    </View>
  );

  if (!ready) return <SafeAreaView style={styles.container}><Text style={styles.title}>My Fitness</Text><Text>{t("正在准备本地数据库…","Preparing local database…")}</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View><Text style={styles.title}>My Fitness</Text><Text style={styles.subtitle}>{t("身体数据记录","Body measurements")}</Text></View>
        <Pressable style={styles.lang} onPress={() => setLang(zh ? "de" : "zh")}><Text style={styles.langText}>{zh ? "DE" : "中文"}</Text></Pressable>
      </View>

      {screen === "home" ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable style={styles.primary} onPress={() => setScreen("add")}><Text style={styles.primaryText}>＋  {t("添加一次测量","Add measurement")}</Text></Pressable>
          <Text style={styles.section}>{t("历史测量","Measurement history")}</Text>
          {records.length === 0 ? <Text style={styles.muted}>{t("还没有保存记录。添加第一次 BodyCheck 吧。","No saved records yet. Add your first BodyCheck.")}</Text> :
            records.map(r => (
              <View style={styles.record} key={r.id}>
                <Text style={styles.recordDate}>{r.date}</Text>
                <Text style={styles.recordInfo}>
                  {t("体重","Weight")}: {r.metrics.weight || "—"} kg　{t("体脂率","Body fat")}: {r.metrics.bodyFat || "—"} %
                </Text>
                <Text style={styles.small}>{t("已保存","Saved")}: {r.photos.length} {t("张照片","photos")}</Text>
              </View>
            ))
          }
          <View style={styles.note}><Text style={styles.noteText}>{t("当前第一版：本机保存、历史记录、日期可编辑和数据手动录入。自动识别及曲线图将在后续版本加入。","First version: local storage, history, editable date and manual data entry. Automatic recognition and charts will be added in a later version.")}</Text></View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => setScreen("home")}><Text style={styles.back}>‹  {t("返回","Back")}</Text></Pressable>
          <Text style={styles.section}>{t("新建 BodyCheck 记录","New BodyCheck record")}</Text>
          <Text style={styles.label}>{t("测量日期（可修改）","Measurement date (editable)")}</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          <Pressable style={styles.secondary} onPress={choosePhotos}><Text style={styles.secondaryText}>{t("选择三张报告照片","Choose 3 report photos")}</Text></Pressable>
          <View style={styles.photoRow}>
            {[0,1,2].map(i => <View style={styles.photoBox} key={i}>
              {photos[i] ? <Image source={{uri: photos[i]}} style={styles.photo} /> : <Text style={styles.photoPlaceholder}>{t("照片","Photo")} {i+1}</Text>}
            </View>)}
          </View>
          <Text style={styles.section}>{t("总体指标","Overall metrics")}</Text>
          {field("weight",t("体重 kg","Weight kg"))}
          {field("bodyFat",t("体脂率 %","Body fat %"))}
          {field("muscle",t("肌肉量 kg","Muscle mass kg"))}
          {field("bmi","BMI")}
          {field("ffmi","FFMI")}
          <Text style={styles.section}>{t("分段瘦体重 kg","Segmental lean mass kg")}</Text>
          {field("trunkLean",t("躯干","Trunk"))}
          {field("rightArmLean",t("右臂","Right arm"))}
          {field("leftArmLean",t("左臂","Left arm"))}
          {field("rightLegLean",t("右腿","Right leg"))}
          {field("leftLegLean",t("左腿","Left leg"))}
          <Text style={styles.section}>{t("分段脂肪量 kg","Segmental fat mass kg")}</Text>
          {field("trunkFat",t("躯干","Trunk"))}
          {field("rightArmFat",t("右臂","Right arm"))}
          {field("leftArmFat",t("左臂","Left arm"))}
          {field("rightLegFat",t("右腿","Right leg"))}
          {field("leftLegFat",t("左腿","Left leg"))}
          <Pressable style={styles.primary} onPress={saveRecord}><Text style={styles.primaryText}>{t("确认并保存在本机","Confirm & save on device")}</Text></Pressable>
          <Text style={styles.small}>{t("注意：此版本尚未接入 OCR；请检查并手动填写数值。","Note: OCR is not connected in this version; enter values manually after checking the report.")}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:"#F5F7F8",paddingTop:Platform.OS==="android"?24:0},
  header:{paddingHorizontal:20,paddingVertical:16,flexDirection:"row",justifyContent:"space-between",alignItems:"center",backgroundColor:"#FFFFFF"},
  title:{fontSize:26,fontWeight:"800",color:"#173B35"},
  subtitle:{fontSize:13,color:"#66756F",marginTop:3},
  lang:{borderWidth:1,borderColor:"#CBD8D3",borderRadius:20,paddingVertical:8,paddingHorizontal:14},
  langText:{fontWeight:"700",color:"#173B35"},
  content:{padding:18,paddingBottom:48},
  primary:{backgroundColor:"#176B55",padding:16,borderRadius:12,alignItems:"center",marginVertical:8},
  primaryText:{color:"#FFFFFF",fontSize:16,fontWeight:"700"},
  secondary:{backgroundColor:"#E4F0EC",padding:14,borderRadius:10,alignItems:"center",marginTop:12},
  secondaryText:{color:"#145A49",fontWeight:"700"},
  section:{fontSize:18,fontWeight:"800",color:"#203B35",marginTop:22,marginBottom:10},
  muted:{color:"#73817B",marginTop:8,lineHeight:22},
  record:{backgroundColor:"#FFFFFF",padding:15,borderRadius:12,marginBottom:10},
  recordDate:{fontSize:16,fontWeight:"800",color:"#173B35"},
  recordInfo:{marginTop:7,color:"#40534C"},
  small:{fontSize:12,color:"#7A8982",marginTop:7,lineHeight:18},
  note:{backgroundColor:"#EAF1EE",padding:13,borderRadius:10,marginTop:18},
  noteText:{color:"#4B6259",lineHeight:20,fontSize:13},
  back:{color:"#176B55",fontWeight:"700",fontSize:16,marginBottom:8},
  label:{fontSize:13,fontWeight:"700",color:"#4C5D56",marginBottom:6,marginTop:10},
  input:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#D9E1DD",borderRadius:9,paddingHorizontal:12,paddingVertical:11,fontSize:16,color:"#203B35"},
  field:{marginBottom:5},
  photoRow:{flexDirection:"row",gap:8,marginTop:12},
  photoBox:{flex:1,height:105,borderRadius:9,backgroundColor:"#E8EEEB",alignItems:"center",justifyContent:"center",overflow:"hidden"},
  photo:{width:"100%",height:"100%",resizeMode:"cover"},
  photoPlaceholder:{fontSize:12,color:"#718078"}
});