/**
 * Thunderbird Vericode - 打包脚本
 * 用于将插件打包为XPI文件
 */

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

// 读取manifest.json获取版本信息
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const version = manifest.version;

// 创建输出目录
const outputDir = path.join(__dirname, "dist");
if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir);
}

// 输出文件路径
const outputFile = path.join(outputDir, `thunderbird-vericode-${version}.xpi`);

// 创建文件写入流
const output = fs.createWriteStream(outputFile);
const archive = archiver("zip", {
	zlib: { level: 9 }, // 最高压缩级别
});

// 监听输出流结束事件
output.on("close", () => {
	console.log(`XPI文件创建成功: ${outputFile}`);
	console.log(`文件大小: ${archive.pointer()} 字节`);
});

// 监听错误事件
archive.on("error", (err) => {
	throw err;
});

// 将输出流管道连接到归档
archive.pipe(output);

// 需要包含的文件和目录
const filesToInclude = ["manifest.json", "background.js", "icons", "options"];

// 添加文件到归档
filesToInclude.forEach((item) => {
	const itemPath = path.join(__dirname, item);

	if (fs.existsSync(itemPath)) {
		const stats = fs.statSync(itemPath);

		if (stats.isDirectory()) {
			// 添加目录
			archive.directory(itemPath, item);
		} else {
			// 添加文件
			archive.file(itemPath, { name: item });
		}
	} else {
		console.warn(`警告: ${item} 不存在，已跳过`);
	}
});

// 添加README文件
archive.file("README.md", { name: "README.md" });

// 完成归档
archive.finalize();
