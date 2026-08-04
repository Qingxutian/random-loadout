// ============================================================
// 三角洲行动 · 随机配装数据
// 这里的所有装备、价格、干员都可以随意增删改。
// 价格单位为哈夫币，仅为娱乐性参考，不代表游戏内实时行情。
// ============================================================

(function () {
const DATA = {
  operators: [
    { name: "红狼", real: "凯·席尔瓦", role: "突击" },
    { name: "威龙", real: "王宇昊", role: "突击" },
    { name: "疾风", real: "克莱尔·安·拜尔斯", role: "突击" },
    { name: "无名", real: "埃利·德·蒙贝尔", role: "突击" },
    { name: "露娜", real: "金卢娜", role: "侦察" },
    { name: "骇爪", real: "麦晓雯", role: "侦察" },
    { name: "蜂医", real: "罗伊斯·米", role: "支援" },
    { name: "蛊", real: "佐娅·庞琴科娃", role: "支援" },
    { name: "乌鲁鲁", real: "大卫·费莱尔", role: "工程" },
    { name: "深蓝", real: "阿列克谢·彼得罗夫", role: "工程" },
    { name: "牧羊人", real: "泰瑞·缪萨", role: "工程" }
  ],

  weapons: [
    // 冲锋枪
    { name: "UZI", cat: "冲锋枪", price: 15000 },
    { name: "野牛 PP-19", cat: "冲锋枪", price: 18000 },
    { name: "勇士 PP-19-01", cat: "冲锋枪", price: 24000 },
    { name: "MP5", cat: "冲锋枪", price: 22000 },
    { name: "SMG-45", cat: "冲锋枪", price: 26000 },
    { name: "SR-3M", cat: "冲锋枪", price: 42000 },
    { name: "P90", cat: "冲锋枪", price: 32000 },
    { name: "MP7", cat: "冲锋枪", price: 28000 },
    { name: "Vector", cat: "冲锋枪", price: 38000 },
    { name: "QCQ171", cat: "冲锋枪", price: 36000 },
    { name: "MK4", cat: "冲锋枪", price: 30000 },
    // 突击步枪
    { name: "CAR-15", cat: "突击步枪", price: 12000 },
    { name: "AKS-74U", cat: "突击步枪", price: 18000 },
    { name: "M4A1", cat: "突击步枪", price: 38000 },
    { name: "AKM", cat: "突击步枪", price: 32000 },
    { name: "QBZ-95-1", cat: "突击步枪", price: 36000 },
    { name: "K416", cat: "突击步枪", price: 45000 },
    { name: "K437", cat: "突击步枪", price: 55000 },
    { name: "AK-12", cat: "突击步枪", price: 50000 },
    { name: "PTR-32", cat: "突击步枪", price: 35000 },
    { name: "AS Val（巨浪）", cat: "突击步枪", price: 65000 },
    { name: "腾龙", cat: "突击步枪", price: 60000 },
    { name: "AUG", cat: "突击步枪", price: 40000 },
    { name: "M16A4", cat: "突击步枪", price: 30000 },
    { name: "SG552", cat: "突击步枪", price: 28000 },
    // 战斗步枪
    { name: "G3", cat: "战斗步枪", price: 42000 },
    { name: "SCAR-H", cat: "战斗步枪", price: 72000 },
    { name: "Ash-12", cat: "战斗步枪", price: 78000 },
    { name: "M7", cat: "战斗步枪", price: 88000 },
    // 精确射手步枪
    { name: "MK12", cat: "精确射手步枪", price: 90000 },
    { name: "M14", cat: "精确射手步枪", price: 110000 },
    { name: "G28", cat: "精确射手步枪", price: 105000 },
    { name: "SVD", cat: "精确射手步枪", price: 100000 },
    { name: "M110", cat: "精确射手步枪", price: 120000 },
    // 栓动狙击
    { name: "M24", cat: "栓动狙击", price: 90000 },
    { name: "M700", cat: "栓动狙击", price: 95000 },
    { name: "M200", cat: "栓动狙击", price: 180000 },
    { name: "AWM", cat: "栓动狙击", price: 200000 },
    // 轻机枪
    { name: "QJB201", cat: "轻机枪", price: 100000 },
    { name: "PKM", cat: "轻机枪", price: 95000 },
    { name: "M250", cat: "轻机枪", price: 115000 },
    { name: "M249", cat: "轻机枪", price: 130000 },
    // 霰弹枪
    { name: "M870", cat: "霰弹枪", price: 25000 },
    { name: "莫斯伯格 590", cat: "霰弹枪", price: 30000 },
    { name: "M1014", cat: "霰弹枪", price: 40000 },
    { name: "SPAS-12", cat: "霰弹枪", price: 45000 },
    { name: "AA-12", cat: "霰弹枪", price: 80000 },
    // 手枪
    { name: "G17", cat: "手枪", price: 8000 },
    { name: "G18", cat: "手枪", price: 15000 },
    { name: "QSZ92G", cat: "手枪", price: 9000 },
    { name: "93R", cat: "手枪", price: 12000 },
    { name: "M1911", cat: "手枪", price: 10000 },
    { name: ".357 左轮", cat: "手枪", price: 16000 },
    { name: "沙漠之鹰", cat: "手枪", price: 18000 }
  ],

  attachments: [
    { name: "红点瞄准镜", price: 8000 },
    { name: "全息瞄准镜", price: 12000 },
    { name: "2.5 倍瞄准镜", price: 15000 },
    { name: "3.5 倍瞄准镜", price: 22000 },
    { name: "消音器", price: 14000 },
    { name: "制退器", price: 9000 },
    { name: "消焰器", price: 6000 },
    { name: "垂直握把", price: 10000 },
    { name: "斜角握把", price: 8000 },
    { name: "战术激光", price: 9000 },
    { name: "扩容弹匣", price: 12000 },
    { name: "快速弹匣", price: 7000 },
    { name: "稳定枪托", price: 11000 },
    { name: "加长枪管", price: 18000 },
    { name: "战术护木", price: 15000 },
    { name: "精密枪管", price: 40000 },
    { name: "大口径制退器", price: 25000 },
    { name: "热成像瞄具", price: 120000 },
    { name: "夜视镜", price: 150000 }
  ],

  armor: [
    { name: "轻型避弹衣", price: 4000 },
    { name: "HT 战术背心", price: 8000 },
    { name: "标准防弹背心", price: 16000 },
    { name: "精英防弹背心", price: 32000 },
    { name: "突击者战术背心", price: 55000 },
    { name: "重型突击背心", price: 95000 },
    { name: "DT-AVS 防弹衣", price: 150000 },
    { name: "五级防弹衣", price: 180000 },
    { name: "六级金刚防弹衣", price: 320000 }
  ],

  helmets: [
    { name: "户外棒球帽", price: 1000 },
    { name: "轻质头盔", price: 6000 },
    { name: "标准头盔", price: 13000 },
    { name: "精英头盔", price: 28000 },
    { name: "战术头盔", price: 60000 },
    { name: "重型战术头盔", price: 110000 },
    { name: "五级重装头盔", price: 150000 },
    { name: "六级自闭头盔", price: 280000 }
  ],

  backpacks: [
    { name: "小型战术背包", price: 3000 },
    { name: "GA 野战背包", price: 8000 },
    { name: "突袭战术背包", price: 15000 },
    { name: "雨林猎手背包", price: 26000 },
    { name: "大型战术背包", price: 45000 },
    { name: "重型突击背包", price: 80000 },
    { name: "大型登山包", price: 100000 },
    { name: "重型战术背包", price: 140000 }
  ],

  rigs: [
    { name: "简易胸挂", price: 2000 },
    { name: "G01 战术胸挂", price: 8000 },
    { name: "DSA 战术胸挂", price: 16000 },
    { name: "突击者胸挂", price: 30000 },
    { name: "重型胸挂", price: 60000 },
    { name: "六级重型胸挂", price: 100000 }
  ],

  // 烽火地带地图：难度列表 + 对应战备门槛（哈夫币）
  maps: {
    "零号大坝": { difficulties: ["普通", "机密"], requirement: { "普通": 0, "机密": 112500 } },
    "长弓溪谷": { difficulties: ["普通", "机密"], requirement: { "普通": 0, "机密": 112500 } },
    "巴克什": { difficulties: ["机密", "绝密"], requirement: { "机密": 187500, "绝密": 550000 } },
    "航天基地": { difficulties: ["机密", "绝密"], requirement: { "机密": 187500, "绝密": 600000 } },
    "永夜大坝": { difficulties: ["永夜"], requirement: { "永夜": 187500 } },
    "潮汐监狱": { difficulties: ["绝密"], requirement: { "绝密": 780000 } }
  }
};

// 浏览器：挂到全局供 core.js / app.js 使用
// Node (ESM/CJS)：支持两种导出方式，方便测试
if (typeof module !== "undefined" && module.exports) {
  module.exports = DATA;
} else if (typeof globalThis !== "undefined") {
  globalThis.DATA = DATA;
}
})();
