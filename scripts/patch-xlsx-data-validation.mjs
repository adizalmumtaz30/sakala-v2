import fs from "node:fs";
import path from "node:path";

const files = [
  path.resolve("node_modules/xlsx/xlsx.mjs"),
  path.resolve("node_modules/xlsx/xlsx.js"),
];

const helper = `\nfunction write_ws_xml_data_validations(ws) {\n  if(!ws['!dataValidation'] || !ws['!dataValidation'].length) return "";\n  var out = ['<dataValidations count="' + ws['!dataValidation'].length + '">'];\n  for(var i = 0; i < ws['!dataValidation'].length; ++i) {\n    var v = ws['!dataValidation'][i];\n    out.push('<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="' + escapexml(v.sqref) + '">');\n    out.push('<formula1>' + escapexml(v.formula1) + '</formula1>');\n    out.push('</dataValidation>');\n  }\n  out.push('</dataValidations>');\n  return out.join("");\n}\n`;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("function write_ws_xml_data_validations(ws)")) continue;

  const marker = "function write_ws_xml(idx";
  const fnIndex = source.indexOf(marker);
  if (fnIndex < 0) throw new Error(`Cannot locate writer in ${file}`);
  source = source.slice(0, fnIndex) + helper + source.slice(fnIndex);

  const localStart = source.indexOf(marker);
  const mergeMarker = "if(ws['!merges']";
  const mergeIndex = source.indexOf(mergeMarker, localStart);
  if (mergeIndex < 0) throw new Error(`Cannot locate merge hook in ${file}`);
  source = source.slice(0, mergeIndex) + "if(ws['!dataValidation']) o[o.length] = write_ws_xml_data_validations(ws);\n\t" + source.slice(mergeIndex);

  fs.writeFileSync(file, source);
  console.log(`Patched ${file}`);
}
