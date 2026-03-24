const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 載入設定檔
let config;
try {
  const configData = fs.readFileSync('grid.json', 'utf8');
  config = JSON.parse(configData);
} catch (err) {
  console.error('無法讀取 grid.json:', err);
  process.exit(1);
}

const {
  input_dir,
  output_dir,
  output_filename,
  canvas_width,
  canvas_height,
  card_width,
  card_height,
  spacing,
  radius,
  columns,
  rows,
  force_jpg,
  jpg_quality,
  background_color,
  text_overlay
} = config;

/** 輔助邏輯：簡單的文字寬度估計 (基於 ASCII 與 CJK) **/
function estimateWidth(line, fontSize) {
  let width = 0;
  for (const char of line) {
    const isASCII = /^[\x00-\x7F]*$/.test(char);
    width += isASCII ? 0.55 : 1.0;
  }
  return width * fontSize;
}

async function mergeImages() {
  if (!fs.existsSync(output_dir)) {
    fs.mkdirSync(output_dir, { recursive: true });
  }

  const files = fs.readdirSync(input_dir)
    .filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f))
    .slice(0, columns * rows);

  if (files.length === 0) {
    console.error(`在 ${input_dir} 找不到任何圖檔。`);
    return;
  }

  // 1. 基本設定
  const gridContentWidth = columns * card_width + (columns - 1) * spacing;
  const gridContentHeight = rows * card_height + (rows - 1) * spacing;
  const finalCanvasWidth = (canvas_width && canvas_width > 0) ? canvas_width : (gridContentWidth + spacing * 2);
  const finalCanvasHeight = (canvas_height && canvas_height > 0) ? canvas_height : (gridContentHeight + spacing * 2);

  const offsetX = Math.floor((finalCanvasWidth - gridContentWidth) / 2);
  const offsetY = Math.floor((finalCanvasHeight - gridContentHeight) / 2);

  const roundedCornersMask = Buffer.from(
    `<svg><rect x="0" y="0" width="${card_width}" height="${card_height}" rx="${radius}" ry="${radius}" fill="white"/></svg>`
  );

  // 2. 處理小圖卡
  const processedImages = await Promise.all(
    files.map(async (file, index) => {
      const inputPath = path.join(input_dir, file);
      const buffer = await sharp(inputPath)
        .resize(card_width, card_height, { fit: 'cover' })
        .composite([{ input: roundedCornersMask, blend: 'dest-in' }])
        .png() 
        .toBuffer();

      const col = index % columns;
      const row = Math.floor(index / columns);
      const left = offsetX + col * (card_width + spacing);
      const top = offsetY + row * (card_height + spacing);
      return { input: buffer, top, left };
    })
  );

  // 3. 處理文字疊加 (SVG)
  if (text_overlay && text_overlay.enable) {
    const { title, align, fontFamily, font_size, offset_x, offset_y, customColors, layout } = text_overlay;
    const lines = title.split('\n');

    // 計算亮度 (基於背景顏色)
    const { r, g, b } = background_color;
    const isDark = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;

    // 字體大小
    const fontSize = (font_size && font_size > 0) 
      ? font_size 
      : Math.floor(finalCanvasWidth * layout.fontSizeRatio);

    const lineHeight = fontSize * 1.4;
    const fontWeight = layout.bold ? 'bold' : 'normal';
    const fontStyle = layout.italic ? 'italic' : 'normal';
    const fontStack = Array.isArray(fontFamily) ? fontFamily.join(',') : fontFamily;

    let textColor, shadowColor;
    if (customColors.useAutoLuminance) {
      textColor = isDark ? '#ffffff' : '#222222';
      shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)';
    } else {
      textColor = customColors.forceTextColor;
      shadowColor = customColors.forceShadowColor;
    }

    // 基礎坐標 + offset 微調
    const xBase = finalCanvasWidth / 2 + (offset_x || 0);
    const totalHeight = lines.length * lineHeight;
    const yBase = (finalCanvasHeight - totalHeight) / 2 + (fontSize * 0.85) + (offset_y || 0);

    // 背景矩形
    let bgRects = '';
    if (layout.titleBgEnable) {
      bgRects = lines.map((line, i) => {
        const lineW = estimateWidth(line, fontSize);
        const bgPadding = fontSize * layout.titleBgPaddingRatio;
        const rectW = lineW + bgPadding * 2;
        const rectH = fontSize * 1.2 + bgPadding * 2;
        const rectX = xBase - (rectW / 2);
        const rectY = yBase + (i * lineHeight) - fontSize * (1.0 + layout.titleBgOffsetYRatio) - bgPadding;
        return `<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" fill="${layout.titleBgColor}" fill-opacity="${layout.titleBgOpacity}" rx="${layout.titleBgRadius}" ry="${layout.titleBgRadius}" />`;
      }).join('');
    }

    const genSpans = (dx = 0, dy = 0) => lines.map((line, i) => {
      return `<tspan x="${xBase + dx}" y="${yBase + dy + i * lineHeight}">${line}</tspan>`;
    }).join('');

    const textAnchor = 'middle';
    const svgOverlay = `
    <svg width="${finalCanvasWidth}" height="${finalCanvasHeight}" viewBox="0 0 ${finalCanvasWidth} ${finalCanvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .titleStyle { 
          font-family: "${fontStack}"; 
          font-weight: ${fontWeight}; 
          font-style: ${fontStyle};
          font-size: ${fontSize}px; 
          text-anchor: ${textAnchor}; 
        }
      </style>
      ${bgRects}
      ${layout.shadowEnable ? `<text class="titleStyle" fill="${shadowColor}">${genSpans(layout.shadowOffset, layout.shadowOffset)}</text>` : ''}
      <text class="titleStyle" fill="${textColor}">${genSpans(0, 0)}</text>
    </svg>`;

    processedImages.push({ input: Buffer.from(svgOverlay), top: 0, left: 0 });
  }

  // 4. 建立畫布並儲存
  const finalBackground = force_jpg ? { ...background_color, alpha: 1 } : background_color;
  let imagePipeline = sharp({
    create: { width: finalCanvasWidth, height: finalCanvasHeight, channels: 4, background: finalBackground }
  }).composite(processedImages);

  const finalExt = force_jpg ? 'jpg' : 'png';
  const finalPath = path.join(output_dir, `${output_filename}.${finalExt}`);

  if (force_jpg) {
    imagePipeline = imagePipeline.jpeg({ quality: jpg_quality });
  } else {
    imagePipeline = imagePipeline.png();
  }

  await imagePipeline.toFile(finalPath);
  console.log(`成功完成！(微調偏移: X=${text_overlay.offset_x}, Y=${text_overlay.offset_y})`);
}

mergeImages().catch(err => {
  console.error('執行過程中發生錯誤:', err);
});
