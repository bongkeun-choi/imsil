const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const desktopPath = path.join(os.homedir(), "Desktop");
const icoPath = path.resolve("public/app-icon.ico");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const targetUrl = "https://bongkeun-choi.github.io/imsil/";

const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${desktopPath.replace(/\\/g, "\\\\")}\\\\장모님 절임배추 주문관리.lnk")
$Shortcut.TargetPath = "${chromePath.replace(/\\/g, "\\\\")}"
$Shortcut.Arguments = "--app=${targetUrl}"
$Shortcut.IconLocation = "${icoPath.replace(/\\/g, "\\\\")},0"
$Shortcut.Save()
`;

const tempPsFile = path.resolve("scripts/temp_create_shortcut.ps1");
// Write with UTF-8 BOM (\uFEFF) so PowerShell understands Korean text cleanly
fs.writeFileSync(tempPsFile, "\uFEFF" + psScript, "utf-8");

try {
  execSync(`powershell -ExecutionPolicy Bypass -File "${tempPsFile}"`, { stdio: "inherit" });
  console.log("Desktop shortcut (.lnk) created successfully!");
} catch (e) {
  console.error("Failed to create .lnk:", e.message);
} finally {
  if (fs.existsSync(tempPsFile)) {
    fs.unlinkSync(tempPsFile);
  }
}
