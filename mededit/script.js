// STORE TEXT AS A COOKIE: "text_field"

// function storing cookies
var date = new Date();
date.setTime(date.getTime() + (10*24*60*60*1000));
const expires = "; expires=" + date.toUTCString();
function setCookie(name,value) {
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function save_text_to_cookie() {
    // must encode the field cookie to ensure \n gets saved
    setCookie("text_field", encodeURIComponent(document.getElementById("main_input").value));
}


// MOVING CONTEXT MENU
// **********************

// WILL KEEP THE MENU IN BOUNDS
const normalizePozition = (mouseX, mouseY) => {
  // ? compute what is the mouse position relative to the container element (scope)
  const {
    left: scopeOffsetX,
    top: scopeOffsetY,
  } = scope.getBoundingClientRect();

  const scopeX = mouseX - scopeOffsetX;
  const scopeY = mouseY - scopeOffsetY;

  // ? check if the element will go out of bounds
  const outOfBoundsOnX =
    scopeX + contextMenu.clientWidth > scope.clientWidth;

  const outOfBoundsOnY =
    scopeY + contextMenu.clientHeight > scope.clientHeight;

  let normalizedX = mouseX;
  let normalizedY = mouseY;

  // ? normalzie on X
  if (outOfBoundsOnX) {
    normalizedX =
      scopeOffsetX + scope.clientWidth - contextMenu.clientWidth;
  }

  // ? normalize on Y
  if (outOfBoundsOnY) {
    normalizedY =
      scopeOffsetY + scope.clientHeight - contextMenu.clientHeight;
  }

  return {normalizedX, normalizedY};
};


const contextMenu = document.getElementById("context-menu");
const scope = document.querySelector("body");

// DISPLAY MENU AT POSITION ON CLICK
scope.addEventListener("contextmenu", (event) => {
  event.preventDefault();

  const { offsetX: mouseX, offsetY: mouseY } = event;

  const { normalizedX, normalizedY } = normalizePozition(mouseX, mouseY);

  contextMenu.style.top = `${normalizedY}px`;
  contextMenu.style.left = `${normalizedX}px`;

  contextMenu.classList.remove("visible");

  setTimeout(() => {
    contextMenu.classList.add("visible");
  });
});

// REMOVE MENU IF CLICK ELSEWHERE
scope.addEventListener("click", (e) => {
  if (e.target.offsetParent != contextMenu) {
    contextMenu.classList.remove("visible");
  }
});

// ************


// TOGGLE PDF VIEWER LEFT AND RIGHT
const main_input = document.getElementById("main_input");
const toggle_button = document.getElementById("toggle-button");
const pdf_viewer = document.getElementById("pdf")
function toggleButton() {
    if (pdf_viewer.classList.contains("visible")){
        // PDF was visible, hide it!
        toggle_button.classList.add("right");
        pdf_viewer.classList.remove("visible");
        main_input.classList.remove("half");
    }else{
        // PDF was hiden, show it and update it!
        toggle_button.classList.remove("right");
        pdf_viewer.classList.add("visible");
        main_input.classList.add("half")
        
        // TODO : UPDATE PDF
    }
    
}
// ********************



// CREATE THE PDF
// *************************************

     
createPdf();


/*
async function copy_document(src, destination){
    var l = src.getPages().length;
    var pages_out = await destination.copyPages(
        src,
        Array.from(Array(l).keys())
    );
    
    for (var i = 0; i < l; i++){
        await destination.addPage(pages_out[i])
    }
    //return pages_out;
}*/


async function copy_document(src, destination){
    var l = src.getPages().length;
    for (var i =0; i<l; i++){
        await destination.addPage((await destination.copyPages(src, [i]))[0]);
    }
}

async function createPdf() {
// LOAD TEMPLATE
  const url = 'http://christophecaron.ca/consultation.pdf'
  const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
  const template = await PDFLib.PDFDocument.load(existingPdfBytes);
  //const template_pages = template.getPages();
    

    const pdfDoc = await PDFLib.PDFDocument.create();
    
    
    
    await copy_document(template, pdfDoc);
    
    //await pdfDoc.addPage((await pdfDoc.copyPages(template, [0]))[0]);
    
    await copy_document(template, pdfDoc);
    
    // FONT
    const timesRomanFont = await pdfDoc.embedFont(PDFLib.StandardFonts.TimesRoman)
    
const pages = pdfDoc.getPages()
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();
  const fontSize = 12;
  firstPage.drawText('Creating PDFs in JavaScript is awesome!', {
    x: 53,
    y: 381,
    size: fontSize,
    font: timesRomanFont,
    color: PDFLib.rgb(0, 0, 0),
  });
    
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
    
    
    
    const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true });
    document.getElementById('pdf').src = pdfDataUri;
}

