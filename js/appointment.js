/*
 * Prise de rendez-vous — contrat d’API (ébauche)
 *
 * Remplacer l’URL dans index.html : window.ECKL_APPOINTMENT_API
 *
 * POST {ECKL_APPOINTMENT_API}
 * Content-Type: application/json
 * Accept: application/json
 *
 * Corps :
 * {
 *   "firstName": "Camille",
 *   "lastName": "Martin",
 *   "phone": "06 12 34 56 78",
 *   "email": "camille.martin@email.fr",
 *   "service": "visite-devis | renovation | amenagement | embellissement",
 *   "city": "Cognac",
 *   "address": "",
 *   "preferredDate": "2026-11-03",
 *   "timeSlot": "matin | apres-midi",
 *   "message": "",
 *   "consent": true,
 *   "source": "site"
 * }
 *
 * Succès attendu : HTTP 200 ou 201.
 * L’API devra autoriser l’origine du site (CORS) sur POST.
 */
(function () {
  var form = document.querySelector("#appointment-form");
  if (!form) return;

  var apiUrl = window.ECKL_APPOINTMENT_API;
  var statusEl = document.querySelector("#form-status");
  var submitButton = document.querySelector("#submit-appointment");
  var phoneInput = form.querySelector("#phone");
  var dateInput = form.querySelector("#preferred-date");
  var serviceSelect = form.querySelector("#service");
  var defaultLabel = submitButton.textContent;

  function todayIso() {
    var now = new Date();
    var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  dateInput.min = todayIso();

  function setStatus(message, state) {
    statusEl.textContent = message;
    statusEl.className = "form-status" + (state ? " is-" + state : "");
  }

  function syncService(value) {
    document.querySelectorAll("[data-service]").forEach(function (button) {
      var selected = button.getAttribute("data-service") === value;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.closest(".service").classList.toggle("is-selected", selected);
    });
  }

  document.querySelectorAll("[data-service]").forEach(function (button) {
    button.addEventListener("click", function () {
      var value = button.getAttribute("data-service");
      serviceSelect.value = value;
      syncService(value);
      document.querySelector("#rendez-vous").scrollIntoView({ behavior: "smooth", block: "start" });
      var firstName = form.querySelector("#first-name");
      window.setTimeout(function () {
        firstName.focus({ preventScroll: true });
      }, 400);
    });
  });

  serviceSelect.addEventListener("change", function () {
    syncService(serviceSelect.value);
  });

  form.querySelectorAll("input, select, textarea").forEach(function (field) {
    field.addEventListener("input", function () {
      field.setCustomValidity("");
    });
  });

  function requireTrimmed(input, message) {
    if (!input.value.trim()) {
      input.setCustomValidity(message);
      return false;
    }
    input.setCustomValidity("");
    return true;
  }

  function validatePhone() {
    var digits = phoneInput.value.replace(/\D/g, "");
    if (digits.length < 10) {
      phoneInput.setCustomValidity("Indiquez un numéro à 10 chiffres au moins.");
      return false;
    }
    phoneInput.setCustomValidity("");
    return true;
  }

  function buildPayload() {
    var data = new FormData(form);
    return {
      firstName: String(data.get("firstName") || "").trim(),
      lastName: String(data.get("lastName") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      service: String(data.get("service") || "").trim(),
      city: String(data.get("city") || "").trim(),
      address: String(data.get("address") || "").trim(),
      preferredDate: String(data.get("preferredDate") || "").trim(),
      timeSlot: String(data.get("timeSlot") || "").trim(),
      message: String(data.get("message") || "").trim(),
      consent: data.get("consent") === "on",
      source: "site"
    };
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var textFields = [
      ["#first-name", "Indiquez votre prénom."],
      ["#last-name", "Indiquez votre nom."],
      ["#email", "Indiquez votre e-mail."],
      ["#city", "Indiquez la ville du projet."]
    ];
    textFields.forEach(function (pair) {
      requireTrimmed(form.querySelector(pair[0]), pair[1]);
    });
    validatePhone();

    if (!serviceSelect.value) {
      serviceSelect.setCustomValidity("Choisissez une prestation.");
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!apiUrl) {
      setStatus("L’adresse de l’API de rendez-vous n’est pas configurée.", "error");
      return;
    }

    var payload = buildPayload();
    var controller = new AbortController();
    var timer = window.setTimeout(function () {
      controller.abort();
    }, 15000);

    submitButton.disabled = true;
    submitButton.textContent = "Envoi en cours…";
    setStatus("Envoi de la demande…", "pending");
    console.info("Eckl rendez-vous POST", apiUrl, payload);

    fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().catch(function () {
            return {};
          }).then(function (body) {
            var error = new Error("HTTP " + response.status);
            error.status = response.status;
            error.detail = body && typeof body.message === "string" ? body.message : "";
            throw error;
          });
        }
        form.reset();
        syncService("");
        dateInput.min = todayIso();
        setStatus("Demande envoyée. Antoine Eckl vous recontacte pour confirmer le rendez-vous.", "success");
      })
      .catch(function (error) {
        console.error("Échec de l’envoi du rendez-vous", apiUrl, error);
        var fallback = "La demande n’a pas pu être envoyée. Appelez le 06 12 59 28 07 ou écrivez à eckl.entreprise@gmail.com.";
        setStatus(error && error.detail ? error.detail : fallback, "error");
      })
      .finally(function () {
        window.clearTimeout(timer);
        submitButton.disabled = false;
        submitButton.textContent = defaultLabel;
      });
  });
})();
