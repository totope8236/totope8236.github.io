

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



const forms_options = {
  "progress": {
    x: [118,100],
    y: [458,686],
    maxLines : [23, 36],
    lineHeight: 18,
    maxWidth: 460,
    signature: false
  },
  "consultation":{
    x: [53,30],
    y: [382,705],
    maxLines : [16, 38],
    lineHeight: 17.6,
    maxWidth: 510,
      signature: true
  },
    "sommaire":{
        x:[0,30],
        y:[0,514],
        maxLines : [0,16],
        lineHeight: 18.7,
        maxWidth:530,
        signature:false
    }
};

async function createPdf() {
// LOAD TEMPLATE
    var form_type = getCookie("form_type");
    if (!form_type){
        // default
        form_type="progress"
    }
    
// load template into memory
  const url = './pdfs/'+form_type+'.pdf';
  const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
  const template = await PDFLib.PDFDocument.load(existingPdfBytes);
  
    
// create final doc and put initial pages.
    const pdfDoc = await PDFLib.PDFDocument.create();
    await copy_document(template, pdfDoc);
    
// load options for rendering
    const maxLines = forms_options[form_type].maxLines;
    const l_height = forms_options[form_type].lineHeight;
    const x = forms_options[form_type].x;
    const y = forms_options[form_type].y;
    // FONT
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontSize = 11;
    const maxWidth = forms_options[form_type].maxWidth;
    

    // DIVIDE text based on maxwidth
    const lines = betterBreakLines(
        document.getElementById("main_input").value,
        fontSize,
        font,
        maxWidth
    );
    
    // Start!
    var pages = pdfDoc.getPages();
    var l_index = 0;
    var p_index = 0;
    var end_index = 0;
    
    while (l_index < lines.length){
        if (p_index % 2 == 0){
            // If on an even page
            
            // Check what is the maximum number of lines I can fit
            if (lines.length <= l_index+maxLines[0]){
                
                end_index = lines.length;
            }else{
                end_index = l_index+maxLines[0]
            }
            
            //Add all the lines
            pages[p_index].drawText(lines.slice(l_index, end_index).join("\n"),{
                x: x[0],
                                    y: y[0],
                                    size: fontSize,
                                    font: font,
                                    color: PDFLib.rgb(0, 0, 0),
                                    lineHeight: l_height,
                                    });
        
            // Go to next page
            l_index = end_index;
            p_index += 1;
        }else{
            // on an odd page
            if (lines.length <= l_index+maxLines[1]){
                end_index = lines.length;
            }else{
                // add extra pages if necessary
                end_index = l_index+maxLines[1];
                await copy_document(template, pdfDoc);
                pages = pdfDoc.getPages()
            }
            // draw text
            pages[p_index].drawText(lines.slice(l_index, end_index).join("\n"),{
                                    x: x[1],
                                    y: y[1],
                                    size: fontSize,
                                    font: font,
                                    color: PDFLib.rgb(0, 0, 0),
                                    lineHeight: l_height,
                                    });
            
            // next page
            l_index = end_index;
            p_index += 1;
        }
    }
    
    
    
    
    
    
    if (forms_options[form_type].signature){
        console.log("here");
        // ADD DATE TO BOTTOM OF PAGE
        for (i = 0; i< pages.length; i+=2){
            pages[i].drawText(moment().format("YYYY    MM       DD    HH  mm"), {
                x: 86,
                y: 72,
                size: 12,
                font: font,
                color: PDFLib.rgb(0, 0, 0),
            });

                var sig = getCookie("signature");
                if (!sig){
                    sig = "";
                }

            pages[i].drawText(sig, {
                x: 260,
                y: 75,
                size: 12,
                font: font,
                color: PDFLib.rgb(0, 0, 0),
            });
        }
    
    }
    
    

			// Trigger the browser to download the PDF document
      
    
    
    const pdfBytes = await pdfDoc.save();
    //const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true });
    //document.getElementById('pdf').src = pdfDataUri;
    renderInIframe(pdfBytes);
    //download(pdfBytes, "pdf-lib_page_copying_example.pdf", "application/pdf");
    
}

