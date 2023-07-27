

// CREATE THE PDF
// *************************************
document.addEventListener("DOMContentLoaded", () => {
  createPdf();
});

const renderInIframe = (pdfBytes) => {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  document.getElementById('pdf').src = blobUrl;
};

async function copy_document(src, destination){
    // make temp doc and copy pages
    const pages = await destination.copyPages(
        src,
        src.getPageIndices()
    );
    pages.forEach((page) => destination.addPage(page));
}





const breakTextIntoLines = (text, size, font, maxWidth) => {
  const lines = [];
  let textIdx = 0;
  while (textIdx < text.length) {
    let line = '';
    while (textIdx < text.length) {
      if (text.charAt(textIdx) === '\n') {
        lines.push(line);
        textIdx += 1;
        line = '';
        continue;
      }
      const newLine = line + text.charAt(textIdx);
      if (font.widthOfTextAtSize(newLine, size) > maxWidth) break;
      line = newLine;
      textIdx += 1;
    }
    lines.push(line);
  }
  return lines;
};


async function createPdf() {
// LOAD TEMPLATE
  const url = './pdfs/consultation.pdf';
  const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
  const template = await PDFLib.PDFDocument.load(existingPdfBytes);
  //const template_pages = template.getPages();
    

    const pdfDoc = await PDFLib.PDFDocument.create();
    
    //pdfDoc.addPage();
    
    await copy_document(template, pdfDoc);
    //await copy_document(template, pdfDoc);
    
    // FONT
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.TimesRoman);
    const fontSize = 12;
    const maxWidth = 515;
    
    const lines = breakTextIntoLines(
        document.getElementById("main_input").value,
        fontSize,
        font,
        maxWidth
    )

    var pages = pdfDoc.getPages();
    const firstPage = pages[0];
    
    /*firstPage.drawText(lines.join("\n"), {
    x: 53,
    y: 381,
    size: fontSize,
    font: font,
    color: PDFLib.rgb(0, 0, 0),
    lineHeight: 17.6,
  });*/
    
    var l_index = 0;
    var p_index = 0;
    var end_index = 0;
    var maxLines = [16, 38];
    while (l_index < lines.length){
        if (p_index % 2 == 0){
            if (lines.length <= l_index+maxLines[0]){
                end_index = lines.length;
            }else{
                end_index = l_index+maxLines[0]
            }
            pages[p_index].drawText(lines.slice(l_index, end_index).join("\n"),{
                x: 53,
                                    y: 382,
                                    size: fontSize,
                                    font: font,
                                    color: PDFLib.rgb(0, 0, 0),
                                    lineHeight: 17.6,
                                    });
        
            l_index = end_index;
            p_index += 1;
        }else{
            if (lines.length <= l_index+maxLines[1]){
                end_index = lines.length;
            }else{
                end_index = l_index+maxLines[1];
                await copy_document(template, pdfDoc);
                pages = pdfDoc.getPages()
            }
            pages[p_index].drawText(lines.slice(l_index, end_index).join("\n"),{
                                    x: 30,
                                    y: 705,
                                    size: fontSize,
                                    font: font,
                                    color: PDFLib.rgb(0, 0, 0),
                                    lineHeight: 17.6,
                                    });
        
            l_index = end_index;
            p_index += 1;
        }
    }
    
    
    
    
    
    
    /*
    // ADD DATE TO BOTTOM OF PAGE
    firstPage.drawText(moment().format("YYYY     MM        DD      HH  mm"), {
        x: 86,
        y: 72,
        size: 12,
        font: timesRomanFont,
        color: PDFLib.rgb(0, 0, 0),
    });

    firstPage.drawText("Dre Bastien | Christophe Caron R31719", {
        x: 260,
        y: 75,
        size: 12,
        font: timesRomanFont,
        color: PDFLib.rgb(0, 0, 0),
    });
    
    */

			// Trigger the browser to download the PDF document
      
    
    
    const pdfBytes = await pdfDoc.save();
    //const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true });
    //document.getElementById('pdf').src = pdfDataUri;
    renderInIframe(pdfBytes);
    //download(pdfBytes, "pdf-lib_page_copying_example.pdf", "application/pdf");
    
}

