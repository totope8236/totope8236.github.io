

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
    x: [48,28],
    y: [456,684],
    maxLines : [31, 49],
    lineHeight: 13,
    maxWidth: 540,
    signature: false
  },
  "consultation":{
    x: [53,30],
    y: [382,705],
    maxLines : [22, 51],
    lineHeight: 13,
    maxWidth: 510,
      signature: true
  },
    "sommaire":{
        x:[48,30],
        y:[450,514],
        maxLines : [9,23],
        lineHeight: 13,
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
    var hospital = getCookie("hospital");
    if (!hospital){
        // default
        hospital = "hdq"
    }
// load template into memory
  const url = './pdfs/'+hospital + "/" + form_type+'.pdf';
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
    const fontSize = 10;
    const formMaxWidth = forms_options[form_type].maxWidth;
    

    
    // Take text and remove the metadata
    var t = document.getElementById("main_input").value;
    var regex = /<meta\b[^>]*>([\n\r\s\S]*)<\/meta>/g;
    const meta_out = t.split(regex);
    if (meta_out.length == 3){
        const meta_text = meta_out[1];
        t = meta_out[0] + meta_out[2];
    }
    
    
    // TODO PROCESS META DATA
    
    
    
    // divide text into left and right
    var regex = /<([^\/]*)>([\n\r\s\S]*?)<\/\1>/g;
    
    
    // number of clusters will always be 1+3*n
    var clusters = t.split(regex);
    const n_of_matches = (clusters.length-1)/3 //number of matches
    
    var boundary = [0,0]; // stores [page, line]
    // Start!
    var pages = pdfDoc.getPages();
    var l_index = 0;
    var p_index = 0;
    var end_index = 0;
    
    // 'real" part
    boundary = [0,0];
    var position = [0,0]; // page, line
    var beginning_of_previous = [0,0];
    var previous_type_of_text_block = "f"; //l, r ou f
    
    async function write_text(t, xIndexes, maxWidth){
        // dynamically updates the boundary
        const lines = betterBreakLines(
            t,
            fontSize,
            font,
            maxWidth
        )
        l_index = 0;
        var pages = pdfDoc.getPages();
        while (l_index < lines.length){
            //while I still have lines to paste!
            // get how many lines I will have to write on this page
            var p_index = position[0]
            const possible_l = maxLines[p_index%2]-position[1];
            
            var lines_to_write = 0;
            if (( lines.length-l_index) > possible_l){
                lines_to_write = possible_l;
            }else{
                lines_to_write = (lines.length-l_index);
            }
            
            // add the lines
            pages[p_index].drawText(lines.slice(l_index, l_index+lines_to_write).join("\n"),{
                    x: xIndexes[p_index%2],y: position[1]*-l_height+y[p_index%2],size: fontSize,
                                        font: font,
                                        color: PDFLib.rgb(0, 0, 0),
                                        lineHeight: l_height,
                                        });
            
            // update position
            if (lines_to_write == possible_l){
                // go to next page
                if (p_index%2==1){
                    //if odd, add page
                    await copy_document(template, pdfDoc);
                    pages = pdfDoc.getPages()
                    pages = pdfDoc.getPages();
                }
                position[0] += 1;
                position[1] = 0;
            }else{
                position[1] = position[1] + lines_to_write;
            }
            l_index += lines_to_write;
        }
        //END OF DRAW TEXT FUNCTION
    }
    
    write_text(clusters[0],x,formMaxWidth);
    boundary = position;
    //console.log(clusters);
    for (let i=0; i<n_of_matches;i++){
        var flag = false;
        //console.log(position);
        //console.log(beginning_of_previous);
        
        if ((clusters[i*3+1] == "l" && previous_type_of_text_block == "r") ||
           (clusters[i*3+1] == "r" && previous_type_of_text_block == "l")){
            position = [...beginning_of_previous];
            flag=true;
        }
        previous_type_of_text_block = clusters[i*3+1]; // for the future
        beginning_of_previous = [position[0],position[1]]; // for the future
        
        // DO THE WRITING!
        if (clusters[i*3+1] == "l"){
            write_text(clusters[i*3+2],x,formMaxWidth/2);
        }else{
            write_text(clusters[i*3+2],[x[0]+formMaxWidth/2,x[1]+formMaxWidth/2],formMaxWidth/2);
        }
        

        if ((position[0]*500+position[1])>(boundary[0]*500+boundary[1])){
            boundary = [...position]; // update boundary
        }
        
        position = [...boundary];

        // write extra text IFF its not empty OR second part of dual!
        console.log([clusters[i*3+3]]);
        if (clusters[i*3+3].trim().length!=0 || flag){
            var content = clusters[i*3+3];
            
            if (content != "\n"){
                if (content.trim.length == 0){
                    write_text(content.substring(1),x, formMaxWidth); // just skip the first char
                }else{
                    if (content[0] == "\n"){
                        content = content.substr(1);
                    }
                    if (content[content.length-1] == "\n"){
                        content = content.substr(0,content.length-1);
                    }
                    write_text(content,x,formMaxWidth);
                }
            }
            
            previous_type_of_text_block = "f"
        }
    }
    
    //SAVE AND RENDER PDF
    const pdfBytes = await pdfDoc.save();
    renderInIframe(pdfBytes);
}


// BACKUP FOR CREATE PDF THAT WORKED
async function oldCreatePdf() {
// LOAD TEMPLATE
    var form_type = getCookie("form_type");
    if (!form_type){
        // default
        form_type="progress"
    }
    var hospital = getCookie("hospital");
    if (!hospital){
        // default
        hospital = "hdq"
    }
// load template into memory
  const url = './pdfs/'+hospital + "/" + form_type+'.pdf';
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
    const fontSize = 10;
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
    
    // Extract and remove metadata
    
    
    
    while (l_index < lines.length){
        if (p_index % 2 == 0){
            // If on an even page
            
            // ADD patient METADATA, if available
            
            
            
            
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