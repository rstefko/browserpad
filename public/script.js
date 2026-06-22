var textbox = document.querySelector('#textbox');
var timeoutID = null;
var filenameBox = document.querySelector('#filename');
var findQueryBox = document.querySelector('#find-query');
var findStatus = document.querySelector('#find-status');
var findNext = document.querySelector('#find-next');
var findPrev = document.querySelector('#find-prev');

// Automatically load/save cache in local storage when opening and closing the page
textbox.value = localStorage.getItem('browserpad') || '';
textbox.setSelectionRange(textbox.value.length, textbox.value.length); // Place caret at end of content
calcStats(); // Update counters after loading
function storeLocally() { localStorage.setItem('browserpad', textbox.value); }
window.beforeunload = storeLocally;

// Allow inputting tabs in the textarea instead of changing focus to the next element
// (must use onkeydown to prevent default behavior of moving focus)
textbox.onkeydown = function (event) {
    // Bullet list support
    if (event.key === "Enter" && this.selectionStart === this.selectionEnd) {
        var enterText = this.value;
        var enterPos = this.selectionStart;
        var currentLineStart = enterText.lastIndexOf('\n', enterPos - 1) + 1;
        var currentLineEnd = enterText.indexOf('\n', enterPos);
        if (currentLineEnd === -1) {
            currentLineEnd = enterText.length;
        }

        var currentLine = enterText.substring(currentLineStart, currentLineEnd);
        var bulletMatch = currentLine.match(/^(\s*[-*]\s+)/);
        if (bulletMatch) {
            event.preventDefault();
            var bulletPrefix = bulletMatch[1];

            // End list when Enter is pressed on an empty bullet item
            var bulletContent = currentLine.substring(bulletPrefix.length);
            if (bulletContent.trim() === '') {
                this.value = enterText.substring(0, currentLineStart) + enterText.substring(currentLineEnd);
                this.selectionStart = this.selectionEnd = currentLineStart;
                return;
            }

            this.value = enterText.substring(0, enterPos) + '\n' + bulletPrefix + enterText.substring(enterPos);
            this.selectionStart = this.selectionEnd = enterPos + 1 + bulletPrefix.length;
            return;
        }
    }

    if (event.key === "Tab") {
        event.preventDefault();
        var text = this.value, s = this.selectionStart, e = this.selectionEnd;
        var currentLineStart = text.lastIndexOf('\n', s - 1) + 1;
        var currentLineEnd = text.indexOf('\n', s);
        if (currentLineEnd === -1) {
            currentLineEnd = text.length;
        }
        var currentLine = text.substring(currentLineStart, currentLineEnd);
        var isBulletLine = /^\s*[-*]\s+/.test(currentLine);

        if (s !== e) {
            var lineStart = text.lastIndexOf('\n', s - 1) + 1;
            var endAnchor = (e > 0 && text[e - 1] === '\n') ? e - 1 : e;
            var lineEnd = text.indexOf('\n', endAnchor);
            if (lineEnd === -1) {
                lineEnd = text.length;
            }

            var selectedBlock = text.substring(lineStart, lineEnd);
            if (event.shiftKey) {
                var outdentedBlock = selectedBlock.replace(/^\t/gm, '');
                var removedTabs = selectedBlock.length - outdentedBlock.length;
                var removedBeforeStart = (selectedBlock.substring(0, s - lineStart).match(/^\t/gm) || []).length;

                this.value = text.substring(0, lineStart) + outdentedBlock + text.substring(lineEnd);
                this.selectionStart = s - removedBeforeStart;
                this.selectionEnd = e - removedTabs;
            } else {
                var indentedBlock = selectedBlock.replace(/^/gm, '\t');
                var addedTabs = indentedBlock.length - selectedBlock.length;

                this.value = text.substring(0, lineStart) + indentedBlock + text.substring(lineEnd);
                this.selectionStart = s + 1;
                this.selectionEnd = e + addedTabs;
            }
        } else if (isBulletLine) {
            if (event.shiftKey) {
                var outdentedLine = currentLine.replace(/^(\t| {1,2})/, '');
                var removed = currentLine.length - outdentedLine.length;

                this.value = text.substring(0, currentLineStart) + outdentedLine + text.substring(currentLineEnd);
                this.selectionStart = this.selectionEnd = Math.max(currentLineStart, s - removed);
            } else {
                this.value = text.substring(0, currentLineStart) + '\t' + currentLine + text.substring(currentLineEnd);
                this.selectionStart = this.selectionEnd = s + 1;
            }
        } else {
            this.value = text.substring(0, s) + '\t' + text.substring(e);
            this.selectionStart = this.selectionEnd = s + 1;
        }
    }
};

textbox.onkeyup = function () {
    // Calculate text stats (using onkeyup is needed to update the count when deleting text)
    calcStats();

    // Auto-save to local storage (at most once per second)
    window.clearTimeout(timeoutID);
    timeoutID = window.setTimeout(storeLocally, 1000);
};

// Calculate and display character, words and line counts
function calcStats() {
    updateCount('char', textbox.value.length);
    updateCount('word', textbox.value === "" ? 0 : textbox.value.replace(/\s+/g, ' ').split(' ').length);
    updateCount('line', textbox.value === "" ? 0 : textbox.value.split(/\n/).length);
}
function updateCount(item, value) {
    document.querySelector('#' + item + '-count').textContent = value;
}

function getFindMatches() {
    var query = findQueryBox.value;
    var source = textbox.value;
    var matches = [];

    if (!query || !source) {
        return matches;
    }

    // Case-insensitive search
    var lowerQuery = query.toLowerCase();
    var lowerSource = source.toLowerCase();
    var start = 0;
    while (start <= source.length - query.length) {
        var index = lowerSource.indexOf(lowerQuery, start);
        if (index === -1) {
            break;
        }
        matches.push(index);
        start = index + Math.max(1, query.length);
    }

    return matches;
}

function updateFindStatus(active, total) {
    findStatus.textContent = active + '/' + total;
}

function selectFindResult(matches, index) {
    var start = matches[index];
    var end = start + findQueryBox.value.length;
    textbox.focus();
    textbox.setSelectionRange(start, end);
    updateFindStatus(index + 1, matches.length);
}

function findFromCaret(forward) {
    if (!findQueryBox.value) {
        updateFindStatus(0, 0);
        return;
    }

    var matches = getFindMatches();
    if (!matches.length) {
        updateFindStatus(0, 0);
        return;
    }

    var caret = forward ? textbox.selectionEnd : textbox.selectionStart;
    var targetIndex = -1;

    if (forward) {
        for (var i = 0; i < matches.length; i++) {
            if (matches[i] > caret) {
                targetIndex = i;
                break;
            }
        }
        if (targetIndex === -1) {
            targetIndex = 0;
        }
    } else {
        for (var j = matches.length - 1; j >= 0; j--) {
            if (matches[j] < caret) {
                targetIndex = j;
                break;
            }
        }
        if (targetIndex === -1) {
            targetIndex = matches.length - 1;
        }
    }

    selectFindResult(matches, targetIndex);
}

findQueryBox.addEventListener('input', function () {
    var matches = getFindMatches();
    updateFindStatus(0, matches.length);
});

findQueryBox.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) {
            findPrev.click();
        } else {
            findNext.click();
        }
    }
});

findNext.onclick = function (event) {
    event.preventDefault();
    if (!findQueryBox.value) {
        findQueryBox.focus();
        return;
    }
    findFromCaret(true);
};

findPrev.onclick = function (event) {
    event.preventDefault();
    if (!findQueryBox.value) {
        findQueryBox.focus();
        return;
    }
    findFromCaret(false);
};

// Save textarea contents as a text file
document.querySelector('#save a').onclick = function () {
    this.download = (filenameBox.value || 'browserpad.txt').replace(/^([^.]*)$/, "$1.txt");
    this.href = URL.createObjectURL(new Blob([document.querySelector('#textbox').value], { type: 'text/plain' }));
};

// Load contents from a text file
document.querySelector('#open a').onclick = function () {
    document.querySelector('#open input').click();
};
document.querySelector('#open input').onchange = function () {
    var reader = new FileReader();
    reader.file = this.files[0]; // Custom property so the filenameBox can be set from within reader.onload()
    reader.onload = function () {
        filenameBox.value = this.file.name;
        textbox.value = this.result; // this = FileReader object
        calcStats();
        var matches = getFindMatches();
        updateFindStatus(0, matches.length);
    };
    reader.readAsText(this.files[0]); // this = input element
};

//Toggle Fullwidth vs 80 Column
document.querySelector('#fullwidth').onchange = function () {
    if (this.checked == true) {
        document.getElementById('textbox').style.width = "calc(80ch + 1.5em + " + (textbox.offsetWidth - textbox.clientWidth) + "px)";
    } else {
        document.getElementById('textbox').style.width = "100%";
    }
};

// Toggle spell-checking
document.querySelector('#spellcheck').onchange = function () {
    textbox.spellcheck = this.checked;
};
textbox.spellcheck = document.querySelector('#spellcheck').checked; // Initialize

// Print the content
document.querySelector("#print").onclick = function () {
    window.print();
};

window.addEventListener('keydown', function (event) {
    if (event.key !== 'F3') {
        return;
    }

    if (event.shiftKey) {
        findPrev.click();
    } else {
        findNext.click();
    }
    event.preventDefault();
}, true);

// Keyboard shortcuts for the save and load functions (`Ctrl+S`, `Ctrl+O`)
document.onkeydown = function (event) {
    if (event.ctrlKey || event.metaKey) {
        if (event.key === "f") {
            findQueryBox.focus();
            findQueryBox.select();
            event.preventDefault();
        }
        if (event.key === "s") {
            document.querySelector('#save a').click();
            event.preventDefault();
        }
        else if (event.key === "o") {
            document.querySelector('#open input').click();
            event.preventDefault();
        }
    }
}

// Show the about dialog
document.querySelector("#about-icon").onclick = function () {
    document.querySelector("#about").showModal();
};

updateFindStatus(0, getFindMatches().length);
