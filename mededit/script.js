// STORE TEXT AS A COOKIE: "text_field"

// alt + Shift + V
// alt + shift + 7

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
    
    // SAVE TEXT TO COOKIE
    // must encode the field cookie to ensure \n gets saved
    setCookie("text_field", encodeURIComponent(document.getElementById("main_input").value));
}


function handle_tags() {
    // if last entered characher is >, perform special action!
    if (event.key==">"){
        var myField = document.getElementById("main_input");
        const backup = myField.selectionStart;
        var p = myField.selectionStart-1;
        //console.log("running >");
    
        while (true){
            if (p < 0){
                break;
            }
            var ch = myField.value.charAt(p)
            if ((ch == ' ') || (ch == '\t') || (ch == '\n')){
                break;
            }
            if (ch == '<'){
                insertTextAtPosition("</"+myField.value.substring(p+1,myField.selectionStart) + ">");
                myField.selectionStart = backup;
                myField.selectionEnd = backup;
                break;
            }
            p -= 1;
        }
    }
    
    return null;
}



// MOVING CONTEXT MENU
// *****************************


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


urlTree = "./templateTree.json";

let templateTree;    
fetch(urlTree).then(
        function(u){ return u.json();}
      ).then(
        function(json){
          templateTree = json;
        }
      )


// DISPLAY MENU AT POSITION ON CLICK
scope.addEventListener("contextmenu", (event) => {
  event.preventDefault();

    
  const { offsetX: mouseX, offsetY: mouseY } = event;

    
    // Change value of context menu
    contextMenu.innerHTML = "";
    
    for (const x in templateTree){
        contextMenu.innerHTML += `<div class="item" onclick="menuButtonClick(this, [])">${x}</div>`;
    }
    
    
    
  const { normalizedX, normalizedY } = normalizePozition(mouseX, mouseY);

  contextMenu.style.top = `${normalizedY}px`;
  contextMenu.style.left = `${normalizedX}px`;

  contextMenu.classList.remove("visible");

  setTimeout(() => {
    contextMenu.classList.add("visible");
  });
});

function insertTextAtPosition(myValue){
    var myField = document.getElementById("main_input");
    
    if (myField.selectionStart || myField.selectionStart == '0') {
        var startPos = myField.selectionStart;
        var endPos = myField.selectionEnd;
        myField.value = myField.value.substring(0, startPos)
            + myValue
            + myField.value.substring(endPos, myField.value.length);
    } else {
        myField.value += myValue;
    }
}

function load_template(src){
    return fetch("./templates/"+src).then((res) => res.text());
}

function menuButtonClick(e, parents){
    // e being the element being clicked
    // parents is a list of strings outlining path to get to element e in templateTree
    
    var position = templateTree;
    
    var current = e.innerHTML;
    
    for (const x in parents){
        position = position[parents[x]];
    }
    position = position[current];

    if (position["type"]){
        // If I clicked on an end card.
        
        switch (position["type"]){
            case "short-text":
                insertTextAtPosition(position["value"]);
                break;
            case "long-text":
                //load txt file with name and insets, then saves
                load_template(position["src"]).then((t) => insertTextAtPosition(t)).then((e)=>save_text_to_cookie());
                break;
            case "selector":
                // Displays the fill out form for RDS, for example
                selector_form.innerHTML = "";
                selector_form.innerHTML += `<h3>${position["title"]}</h3>`;
                for (const cat in position["content"]){
                    selector_form.innerHTML += `<input type="checkbox" id="sel-${cat}" name="${cat}">
            <label for="sel-${cat}">${cat}:</label>`
                    
                    for (const el in position["content"][cat]){
                        const t = position["content"][cat][el];
                        selector_form.innerHTML += `<input type="text" placeholder="${t}" size="${t.length}">`;
                    }
                    
                    selector_form.innerHTML += "<br>";
                }
                
                selector_form.innerHTML += `<input type="submit">`;
                selector_form.classList.add("visible");
                break;
        }
        
        
        // Save text after insertion
        save_text_to_cookie();
        
        // Hide context menu now that we're done
        contextMenu.classList.remove("visible");
        
    }else{
        
        // Change value of context menu
        contextMenu.innerHTML = "";
        console.log(`${parents.concat([current]).join("','")}`);
        for (const x in position){
            contextMenu.innerHTML += `<div class="item" onclick="menuButtonClick(this, ['${parents.concat([current]).join("','")}'] )">${x}</div>`;
        }
        // making sure its visible
        contextMenu.classList.add("visible");
    }
    
}



// HANDLE SELECTOR SUBMIT FOR AND ADD TEXT TO PAGE
function submitSelector(e){
    e.preventDefault(); // prevents page refresh
    console.log("page submit");
    
    const form_elements = selector_form.querySelectorAll('input');
    var output = "";
    var flag = false;
    for (var i = 0; i < form_elements.length; i++){
      const current_element = form_elements[i];
      console.log(current_element.type);
      switch (current_element.type){
        case "checkbox":
          if (current_element.checked){
            flag = true;
            output += "\n" + current_element.name + ": ";
          }else{
              flag = false;
          }
          break;
         case "text":
          if (flag){
            if (current_element.value == ""){
                output += current_element.placeholder + ", ";
            }else if (current_element.value == " "){
                // do nothing
            }else{
                output += current_element.value + ", ";
            }
          }
          break;
      }
    }
    insertTextAtPosition(output);
    // Save text after insertion
    save_text_to_cookie();
    // Hide context menu now that we're done
    contextMenu.classList.remove("visible");
    selector_form.classList.remove("visible");
    
}
const selector_form = document.getElementById("s-form");
selector_form.addEventListener("submit", submitSelector)



// REMOVE CONTEXT MENU IF CLICK ELSEWHERE
scope.addEventListener("click", (e) => {
    //console.log(e.target);
    //console.log(e.target.classList.contains("item"));
    if (contextMenu.contains(e.target) || e.target.classList.contains("item")){
        //clicked in box
    }else{
        //clicked out of box
        contextMenu.classList.remove("visible");
    }
    
    //if (e.target.offsetParent != contextMenu) {
        //console.log("clicked out of frame, making menu invisible");
    //contextMenu.classList.remove("visible");
  //}
});



// SHIFT WITH F8 AND F9 between empty tokens.
//******************************
document.addEventListener("keydown", (e) =>{
    const textField = document.getElementById("main_input");
    var startPos = textField.selectionStart;
    var endPos = textField.selectionEnd;
    const refString = String.fromCharCode(parseInt(2021,16));
    var i = -1;
    
    switch (e.key){
        case "F8":
            // move cursor left
            i = textField.value.substring(0,startPos).lastIndexOf(refString);
            if (i != -1){
                //something was found!
                textField.focus();
                textField.setSelectionRange(i, i+1);
            }
            break;
        case "F9":
            i = textField.value.substring(endPos).indexOf(refString);
            if (i != -1){
                //something was found!
                textField.focus();
                textField.setSelectionRange(endPos + i,endPos+ i+1);
            }
            break;
    }
    
});



// *************************************
// ****** SETTINGS *******
// ***********************

function showSettings(){
    var s = getCookie("signature");
    if (!s){
        s = "";
    }
    document.getElementById("signature").value = s;
    
    document.getElementById("settings").classList.add("visible");
}


function saveSettings(){
    const type_select = document.getElementById("form_type");
    setCookie("form_type",encodeURIComponent(type_select.options[type_select.selectedIndex].value));
    
    const hosp_select = document.getElementById("hospital");
   setCookie("hospital",encodeURIComponent(hosp_select.options[hosp_select.selectedIndex].value));
    
    setCookie("signature",document.getElementById("signature").value);
    document.getElementById("settings").classList.remove("visible");
    createPdf();
}


// ****************************************************
// ************    PDF
// ****************************************************


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
        //UPDATE PDF
        createPdf();
        
        // PDF was hiden, show it and update it!
        toggle_button.classList.remove("right");
        pdf_viewer.classList.add("visible");
        main_input.classList.add("half")
        
        
    }
    
}
// ********************

