const fs = require("fs");
const text = fs.readFileSync("sample.txt", "utf8");
const r = /\[OPTION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi;
let m;
const arr = [];
while ((m = r.exec(text)) !== null) {
  arr.push(m[1]);
}
console.log("opts", arr);
