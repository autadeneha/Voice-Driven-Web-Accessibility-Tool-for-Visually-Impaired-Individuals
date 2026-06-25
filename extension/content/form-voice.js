/**
 * VisionaryAI Extension — Smart Form Voice Interface
 * Guided voice interview for any form on any website.
 */
(function () {
  if (window.__vaiFormVoiceLoaded) return;
  window.__vaiFormVoiceLoaded = true;

  let formSession        = false;
  let currentForm        = null;
  let formFields         = [];
  let currentFieldIndex  = 0;
  let awaitingConfirm    = false;
  let pendingValue       = "";
  let retryCount         = 0;

  function getLabel(input) {
    if (input.getAttribute("aria-label")) return input.getAttribute("aria-label").toLowerCase().trim();
    if (input.id) {
      const lbl = document.querySelector(`label[for="${input.id}"]`);
      if (lbl) return lbl.innerText.toLowerCase().trim();
    }
    if (input.name)        return input.name.toLowerCase().replace(/_/g, " ");
    if (input.placeholder) return input.placeholder.toLowerCase().trim();
    return input.type || "field";
  }

  function collectFields(form) {
    return Array.from(form.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]):not([type=button]),textarea,select"
    )).map(el => ({ el, label: getLabel(el), type: el.type || el.tagName.toLowerCase() }));
  }

  function extractValue(speech, type, label) {
    let v = speech.trim();
    if (label.includes("email") || type === "email") {
      v = v.toLowerCase().replace(/\s+at\s+/g,"@").replace(/\s+dot\s+/g,".").replace(/\s/g,"");
    } else if (type === "number") {
      v = v.replace(/[^\d.]/g,"");
    }
    return v;
  }

  window.startFormSession = function () {
    const forms = document.querySelectorAll("form");
    if (!forms.length) { speak("No forms found on this page."); return; }
    currentForm        = forms[0];
    formFields         = collectFields(currentForm);
    formSession        = true;
    currentFieldIndex  = 0;
    awaitingConfirm    = false;

    if (!formFields.length) { speak("Form has no fillable fields."); formSession = false; return; }

    speak(`Smart Form activated. ${formFields.length} fields. I'll guide you through each one.`);
    setTimeout(() => promptField(), 2200);
  };

  function promptField() {
    if (!formSession || currentFieldIndex >= formFields.length) return;
    const f = formFields[currentFieldIndex];
    const n = currentFieldIndex + 1, total = formFields.length;

    if (f.el.tagName === "SELECT") {
      const opts = Array.from(f.el.options).map((o, i) => `${i+1}: ${o.text}`).join(", ");
      speak(`Field ${n} of ${total}: ${f.label}. Options: ${opts}. Say the name or number.`);
    } else if (f.type === "checkbox") {
      speak(`Field ${n} of ${total}: ${f.label}. Say yes or no.`);
    } else {
      speak(`Field ${n} of ${total}: ${f.label}. Please say your ${f.label}.`);
    }
    f.el.focus();
  }

  function applyValue(field, value) {
    const el = field.el;
    if (el.tagName === "SELECT") {
      const opt = Array.from(el.options).find(o =>
        o.text.toLowerCase().includes(value.toLowerCase()) ||
        o.value.toLowerCase() === value.toLowerCase()
      );
      const ordMap = { first:0,"1":0, second:1,"2":1, third:2,"3":2, fourth:3,"4":3, fifth:4,"5":4 };
      if (opt) {
        el.value = opt.value;
      } else if (ordMap[value.toLowerCase()] !== undefined) {
        const idx = ordMap[value.toLowerCase()];
        if (el.options[idx]) el.value = el.options[idx].value;
      }
    } else if (el.type === "checkbox") {
      el.checked = ["yes","true","on","check"].includes(value.toLowerCase());
    } else {
      el.value = value;
      el.dispatchEvent(new Event("input",  { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  window.answerCurrentField = function (speech) {
    if (!formSession) { speak("No active form. Say 'start form' to begin."); return; }
    const lower = speech.toLowerCase().trim();

    if (lower === "skip" || lower === "next field") {
      retryCount = 0; currentFieldIndex++;
      currentFieldIndex >= formFields.length ? reviewForm() : promptField();
      return;
    }
    if (lower === "go back" || lower === "previous field") {
      retryCount = 0; currentFieldIndex = Math.max(0, currentFieldIndex - 1);
      promptField(); return;
    }

    if (awaitingConfirm) {
      if (["yes","correct","yeah","yep"].includes(lower)) {
        applyValue(formFields[currentFieldIndex], pendingValue);
        awaitingConfirm = false; retryCount = 0;
        currentFieldIndex++;
        currentFieldIndex >= formFields.length
          ? setTimeout(() => reviewForm(), 1200)
          : setTimeout(() => promptField(), 700);
      } else if (["no","wrong","incorrect","nope"].includes(lower)) {
        awaitingConfirm = false; retryCount = 0;
        speak(`Let's try again. ${formFields[currentFieldIndex].label}.`);
      } else {
        retryCount++;
        speak(retryCount >= 3 ? "Say 'skip' to move on." : "Say yes to confirm or no to re-enter.");
        if (retryCount >= 3) retryCount = 0;
      }
      return;
    }

    const field    = formFields[currentFieldIndex];
    const extracted = extractValue(speech, field.type, field.label);
    if (!extracted) {
      retryCount++;
      speak(retryCount >= 3 ? "Say 'skip' to move on." : `Didn't catch that. Say your ${field.label}.`);
      if (retryCount >= 3) retryCount = 0;
      return;
    }
    pendingValue    = extracted;
    awaitingConfirm = true;
    speak(`You said: ${extracted}. Is that correct?`);
  };

  window.fillField = function (rawName, value) {
    if (!formSession || !formFields.length) { speak("No active form."); return; }
    const q     = rawName.toLowerCase().trim();
    const match = formFields.find(f =>
      f.label.includes(q) || q.includes(f.label) ||
      f.el.id?.toLowerCase().includes(q) || f.el.name?.toLowerCase().includes(q)
    );
    if (!match) { speak(`No field called "${rawName}".`); return; }
    applyValue(match, extractValue(value, match.type, match.label));
    speak(`Set ${match.label}.`);
    match.el.focus();
  };

  window.reviewForm = function () {
    if (!formSession || !currentForm) { speak("No active form."); return; }
    const parts = formFields.map(f => {
      const val = f.el.type === "checkbox"
        ? (f.el.checked ? "checked" : "unchecked")
        : (f.el.value || "empty");
      return `${f.label}: ${val}`;
    });
    speak("Form summary: " + parts.join(". ") + ". Say 'submit' to send.");
  };

  window.submitForm = function () {
    if (!formSession || !currentForm) { speak("No active form."); return; }
    speak("Submitting form.");
    const btn = currentForm.querySelector("button[type=submit],input[type=submit]");
    if (btn) btn.click(); else currentForm.submit();
    if (typeof playEarcon === "function") playEarcon("success");
    formSession = false; currentForm = null; formFields = [];
  };

  window.clearForm = function () {
    if (!formSession || !currentForm) { speak("No active form."); return; }
    currentForm.reset();
    currentFieldIndex = 0; awaitingConfirm = false;
    speak("Form cleared.");
  };

  window.stopFormSession = function () {
    formSession = false; currentForm = null; formFields = [];
    awaitingConfirm = false;
    speak("Form session ended.");
  };
})();
