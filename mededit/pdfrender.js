

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






const betterBreakLines = (text, size, font, maxWidth) => {
    const lines = [];
    const pre_lines = text.split("\n");
    
    for (var i = 0; i<pre_lines.length; i++){
        var pre_words = pre_lines[i].split(" ");
        var line = "";
        for (var j = 0; j<pre_words.length; j++){
            const newLine = line + " " + pre_words[j];
            if (font.widthOfTextAtSize(newLine, size) > maxWidth){
                if (line == ""){
                    // line was empty, one single big word, split it
                    var k = 0;
                    while (k < pre_words[j].length){
                        console.log(k);
                        if (font.widthOfTextAtSize(pre_words[j].slice(0,k), size) > maxWidth){
                            //too big
                            k -= 1;
                            lines.push(pre_words[j].slice(0,k));
                            pre_words[j] = pre_words[j].slice(k);
                            line = "";
                            j-=1;
                            break;
                        }else{
                            k+=1;
                        }
                    }
                }else{
                    //big line, but has words in it. push line and continue
                    lines.push(line);
                    line = "";
                    j -= 1;
                }
            }else{
                // continue filling current line.
                line = newLine;
            }
            
        }
        lines.push(line);
    }
    return lines;
};



async function createPdf() {
// LOAD TEMPLATE
  const url = './pdfs/progress.pdf';
  const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
  const template = await PDFLib.PDFDocument.load(existingPdfBytes);
  //const template_pages = template.getPages();
    

    const pdfDoc = await PDFLib.PDFDocument.create();
    
    //pdfDoc.addPage();
    
    await copy_document(template, pdfDoc);
    //await copy_document(template, pdfDoc);
    
    // FONT
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontSize = 11;
    const maxWidth = 515;
    
    /*
    const lines = breakTextIntoLines(
        document.getElementById("main_input").value,
        fontSize,
        font,
        maxWidth
    )*/
    
    const lines = betterBreakLines(
        document.getElementById("main_input").value,
        fontSize,
        font,
        maxWidth
    );
    console.log(lines);

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
    var maxLines = [23, 36];
    while (l_index < lines.length){
        if (p_index % 2 == 0){
            if (lines.length <= l_index+maxLines[0]){
                end_index = lines.length;
            }else{
                end_index = l_index+maxLines[0]
            }
            pages[p_index].drawText(lines.slice(l_index, end_index).join("\n"),{
                x: 118,
                                    y: 458,
                                    size: fontSize,
                                    font: font,
                                    color: PDFLib.rgb(0, 0, 0),
                                    lineHeight: 18,
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
                                    x: 100,
                                    y: 686,
                                    size: fontSize,
                                    font: font,
                                    color: PDFLib.rgb(0, 0, 0),
                                    lineHeight: 18,
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

