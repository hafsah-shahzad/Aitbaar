const express = require("express");
const router = express.Router();
const { sendWhatsAppMessage, sendVoiceMessage } = require("../services/whatsappService");
const { downloadWhatsAppMedia } = require("../services/mediaService");
const { transcribeAudio } = require("../services/speechToTextService");
const { convertToSpeech } = require("../services/textToSpeechService");
const { getMembershipsByPhone, registerMemberToCommittee, markRulesAccepted } = require("../services/memberService");
const { findCommitteeByCode } = require("../services/committeeService");
const { saveMessage } = require("../services/messageService");
const { generateResponse } = require("../services/llmService");
const { detectIntent } = require("../services/intentService");
const { detectLanguage, getMessage } = require("../services/languageService");
const { savePaymentRecord, getTrustScore } = require("../services/paymentService");
const { markPositionSatisfied, markPositionChangeRequested, getActiveOrder } = require("../services/payoutAssignmentService");
const { createChangeRequest } = require("../services/payoutChangeService");
const { createPriorityRequest } = require("../services/priorityRequestService");
const { scanMessage, getScamWarningMessage, getOrganizerAlertMessage } = require("../services/scamDetectionService");
const { sendMemberRulesPdf } = require("../services/memberRulesPdfService");
const supabase = require("../config/supabaseClient");
const COMMITTEE_CODE_PATTERN = /C[\s-]?[A-Z0-9]{4,8}/i;

function isValidName(text) {
  if (!text || text.trim().length < 2) return false;
  var lower = text.toLowerCase().trim();
  var reject = ["my name is","mera naam","naam hai","main hoon","i am","mujhe kehte","mujhe bolte","kuch bhi","anything","hello","hi ","salam","aoa","join","payment","committee","yes","no","haan","nahi"];
  for (var i = 0; i < reject.length; i++) { if (lower.includes(reject[i])) return false; }
  if (lower.split(/\s+/).length > 5) return false;
  if (/[?!]/.test(text)) return false;
  return true;
}

function extractName(text) {
  var patterns = [/my name is (.+)/i, /mera naam (.+) hai/i, /mera naam (.+)/i, /main (.+) hoon/i, /naam (.+) hai/i];
  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match && match[1]) {
      var ex = match[1].trim();
      if (ex.split(/\s+/).length <= 4 && ex.length >= 2) return ex;
    }
  }
  return null;
}

var JOIN_PATTERNS = ["join another","join new","dusri committee","aur committee","nai committee","new committee","shamil hona","join committee","kisi aur committee","another committee","add committee","mujhe join","mujhe shamil","mujhe committee"];
var YES_PAT = ["yes","haan","haanji","theek hai","ok","okay","confirm","chalein","acha","1"];
var NO_PAT = ["no","nahi","nahin","cancel","na","2"];
function detectJoinIntent(t) { var l = t.toLowerCase().trim(); return JOIN_PATTERNS.some(function(p) { return l.includes(p); }); }
function isYes(t) { var l = t.toLowerCase().trim(); return YES_PAT.some(function(p) { return l === p || l.startsWith(p); }); }
function isNo(t) { var l = t.toLowerCase().trim(); return NO_PAT.some(function(p) { return l === p || l.startsWith(p); }); }

async function getSession(phone) { var r = await supabase.from("member_sessions").select("*").eq("phone", phone).maybeSingle(); return r.data; }
async function upsertSession(phone, u) {
  var e = await getSession(phone);
  if (e) { await supabase.from("member_sessions").update(Object.assign({}, u, { updated_at: new Date() })).eq("phone", phone); }
  else { await supabase.from("member_sessions").insert([Object.assign({ phone: phone }, u)]); }
}
async function clearSession(phone) { await supabase.from("member_sessions").delete().eq("phone", phone); }

async function reply(from, text, isVoice) {
  if (isVoice) { try { var a = await convertToSpeech(text); await sendVoiceMessage(from, a); } catch (e) { console.error("Voice fail:", e.message); await sendWhatsAppMessage(from, text); } }
  else { await sendWhatsAppMessage(from, text); }
}

function buildCommitteeList(memberships) {
  var out = [];
  memberships.forEach(function(m, i) {
    var n = (m.committees && m.committees.name) || "Committee";
    var a = (m.committees && m.committees.monthly_amount) || "?";
    out.push((i + 1) + ". " + n + " (Rs " + a + "/month)");
  });
  return out.join("\n");
}

// ─────────────────────────────────────────────────────────
// ORGANIZER AUTHORIZATION
// Never trust a user's claim — verify via database.
// ─────────────────────────────────────────────────────────

// Patterns that indicate an organizer-only action
var ORGANIZER_ACTION_PATTERNS = [
  // Bulk messaging / announcements
  "sab members ko bolo", "sab ko bolo", "sab ko message",
  "tell all members", "notify all members", "send to everyone",
  "announce", "broadcast", "message everyone",
  "sab member", "all members ko", "sab ko inform",
  // Payment instruction changes
  "payment is number par", "payment yahan karo", "payment us number",
  "pay to this", "new payment number", "naya payment number",
  "change payment", "payment instructions",
  // Impersonation / authority claims
  "main organizer hoon", "i am the organizer", "main admin hoon",
  "i am the admin", "mujhe admin banao", "make me admin",
  "i am the new admin", "main new admin",
  "mera number naya hai", "new admin number",
  // Rule / order changes
  "rules change", "qawaid change", "rules badlo",
  "payout order change", "payout order badlo",
  "change payout order", "naya payout order",
  // Member management
  "member remove", "member nikalo", "remove member",
  "add member to", "member add karo",
  // Committee-wide financial
  "new account", "naya account", "bank account change",
  "account number change", "iban change",
];

function isOrganizerOnlyAction(transcript) {
  var lower = transcript.toLowerCase().trim();
  return ORGANIZER_ACTION_PATTERNS.some(function(p) {
    return lower.includes(p);
  });
}

async function verifyOrganizer(phoneNumber, committeeId) {
  console.log("[AUTH] Checking organizer authorization for:", phoneNumber);

  // Step 1: Check if this phone is a registered organizer
  var orgResult = await supabase
    .from("organizers")
    .select("id, name, phone")
    .eq("phone", phoneNumber)
    .maybeSingle();

  if (orgResult.error || !orgResult.data) {
    console.log("[AUTH] Organizer verified: false (not found in organizers table)");
    return null;
  }

  // Step 2: If committeeId provided, verify they own that committee
  if (committeeId) {
    var comResult = await supabase
      .from("committees")
      .select("id")
      .eq("id", committeeId)
      .eq("organizer_id", orgResult.data.id)
      .maybeSingle();

    if (comResult.error || !comResult.data) {
      console.log("[AUTH] Organizer verified: false (not organizer of this committee)");
      return null;
    }
  }

  console.log("[AUTH] Organizer verified: true");
  return orgResult.data;
}

router.get("/", function(req, res) {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

router.post("/", async function(req, res) {
  try {
    var entry = req.body.entry && req.body.entry[0];
    var change = entry && entry.changes && entry.changes[0];
    var message = change && change.value && change.value.messages && change.value.messages[0];
    if (!message) return res.sendStatus(200);

    var fromNumber = message.from;
    var transcript = "";
    var isVoiceMessage = false;

    if (message.type === "audio") {
      isVoiceMessage = true;
      console.log("Voice note from " + fromNumber);
      var filePath = await downloadWhatsAppMedia(message.audio.id);
      transcript = await transcribeAudio(filePath);
      console.log("Transcribed:", transcript);
      if (!transcript) { await reply(fromNumber, getMessage("sorryNotUnderstood", "roman_urdu"), isVoiceMessage); return res.sendStatus(200); }
    } else if (message.type === "text") {
      console.log("Text from " + fromNumber);
      transcript = message.text.body;
    } else {
      return res.sendStatus(200);
    }

    var userLang = detectLanguage(transcript);
    console.log("Language:", userLang);

    var memberships = await getMembershipsByPhone(fromNumber);
    var isRegistered = memberships && memberships.length > 0;
    var session = await getSession(fromNumber);
    var sessLang = (session && session.language) || userLang;

    // SCAM SHIELD
    if (isRegistered) {
      var mem0 = memberships[0];
      try {
        var orgResult = await supabase.from("organizers").select("phone").eq("id", mem0.committees && mem0.committees.organizer_id).maybeSingle();
        var orgD = orgResult.data;
        var scam = await scanMessage({ transcript: transcript, senderPhone: fromNumber, senderName: mem0.name, committeeId: mem0.committee_id, committeeName: (mem0.committees && mem0.committees.name) || "Unknown", organizerPhone: (orgD && orgD.phone) || "" });
        console.log("[SCAM] scan complete: score=" + scam.risk_score + ", is_scam=" + scam.is_scam + ", type=" + scam.scam_type);
        if (scam.is_scam) {
          console.log("[SCAM] Suspicious message blocked from:", fromNumber);
          await reply(fromNumber, getScamWarningMessage(scam.flags, scam.scam_type), isVoiceMessage);
          if (orgD && orgD.phone) { sendWhatsAppMessage(orgD.phone, getOrganizerAlertMessage(mem0.name, fromNumber, transcript, scam.risk_score, scam.scam_type)).catch(function() {}); }
          return res.sendStatus(200);
        }
      } catch (se) { console.error("[SCAM] Scam scan error (continuing message flow):", se.message); }
    }

    // === SESSION STATE HANDLERS ===
    if (session && session.state === "awaiting_committee_selection_payment") {
      var si = parseInt(transcript.trim()) - 1;
      if (isNaN(si) || si < 0 || si >= memberships.length) { si = memberships.findIndex(function(m) { return (m.committees && m.committees.name || "").toLowerCase().includes(transcript.toLowerCase().trim()); }); }
      if (si < 0 || si >= memberships.length) { await reply(fromNumber, getMessage("sorryNotUnderstood", sessLang), isVoiceMessage); return res.sendStatus(200); }
      var selMem = memberships[si];
      await upsertSession(fromNumber, { state: "awaiting_payment_amount", pending_committee_id: selMem.committee_id, pending_member_id: selMem.id, context_committee_id: selMem.committee_id, language: sessLang });
      await reply(fromNumber, getMessage("askPaymentAmount", sessLang, { committee: (selMem.committees && selMem.committees.name) || "Committee", amount: (selMem.committees && selMem.committees.monthly_amount) || 0 }), isVoiceMessage);
      return res.sendStatus(200);
    }

    if (session && session.state === "awaiting_payment_amount") {
      var amt = parseInt(transcript.replace(/[^\d]/g, ""));
      if (!amt || amt <= 0) { await reply(fromNumber, getMessage("sorryNotUnderstood", sessLang), isVoiceMessage); return res.sendStatus(200); }
      var ctxId = session.context_committee_id || session.pending_committee_id;
      var tMem = memberships.find(function(m) { return m.committee_id === ctxId; }) || memberships[0];
      await savePaymentRecord({ memberId: tMem.id, committeeId: ctxId, amount: amt });
      var cn2 = (tMem.committees && tMem.committees.name) || "Committee";
      await clearSession(fromNumber);
      await reply(fromNumber, getMessage("pendingPayment", sessLang, { amount: amt, committee: cn2 }), isVoiceMessage);
      var org2 = await supabase.from("organizers").select("phone").eq("id", tMem.committees && tMem.committees.organizer_id).maybeSingle();
      if (org2.data && org2.data.phone) { sendWhatsAppMessage(org2.data.phone, "[Aitbaar] " + (tMem.name || fromNumber) + " ne \"" + cn2 + "\" ki Rs " + amt + " payment claim ki hai.").catch(function() {}); }
      return res.sendStatus(200);
    }

    if (session && session.state === "awaiting_committee_selection_priority") {
      var si2 = parseInt(transcript.trim()) - 1;
      if (isNaN(si2) || si2 < 0 || si2 >= memberships.length) { si2 = memberships.findIndex(function(m) { return (m.committees && m.committees.name || "").toLowerCase().includes(transcript.toLowerCase().trim()); }); }
      if (si2 < 0 || si2 >= memberships.length) { await reply(fromNumber, getMessage("sorryNotUnderstood", sessLang), isVoiceMessage); return res.sendStatus(200); }
      var s2 = memberships[si2];
      await upsertSession(fromNumber, { state: "awaiting_priority_voice", pending_committee_id: s2.committee_id, pending_member_id: s2.id, context_committee_id: s2.committee_id, language: sessLang });
      await reply(fromNumber, getMessage("askPriorityReason", sessLang, { committee: (s2.committees && s2.committees.name) || "Committee" }), isVoiceMessage);
      return res.sendStatus(200);
    }

    if (session && session.state === "awaiting_committee_selection_trust") {
      var si3 = parseInt(transcript.trim()) - 1;
      if (isNaN(si3) || si3 < 0 || si3 >= memberships.length) { si3 = memberships.findIndex(function(m) { return (m.committees && m.committees.name || "").toLowerCase().includes(transcript.toLowerCase().trim()); }); }
      if (si3 < 0 || si3 >= memberships.length) { await reply(fromNumber, getMessage("sorryNotUnderstood", sessLang), isVoiceMessage); return res.sendStatus(200); }
      var s3 = memberships[si3];
      var sc3 = await getTrustScore(s3.id, s3.committee_id);
      var sm3 = sc3 >= 80 ? "Excellent!" : sc3 >= 50 ? "Good - pay regularly." : "Low - pay on time.";
      await clearSession(fromNumber);
      await reply(fromNumber, getMessage("trustScoreResponse", sessLang, { committee: (s3.committees && s3.committees.name) || "Committee", score: sc3, message: sm3 }), isVoiceMessage);
      return res.sendStatus(200);
    }

    if (session && session.state === "awaiting_name") {
      var raw = transcript.trim();
      var name = extractName(raw) || raw;
      if (!isValidName(name)) { await reply(fromNumber, getMessage("invalidName", sessLang), isVoiceMessage); return res.sendStatus(200); }
      await supabase.from("members").update({ name: name }).eq("phone", fromNumber).eq("committee_id", session.pending_committee_id);
      await upsertSession(fromNumber, { state: "awaiting_rules_acceptance", pending_committee_id: session.pending_committee_id, pending_member_id: session.pending_member_id, pending_member_name: name, language: sessLang });
      await sendMemberRulesPdf(fromNumber, sessLang);
      await reply(fromNumber, getMessage("rulesAcceptancePrompt", sessLang), isVoiceMessage);
      return res.sendStatus(200);
    }

    if (session && session.state === "awaiting_rules_acceptance") {
      if (isYes(transcript)) {
        await markRulesAccepted(fromNumber, session.pending_committee_id);
        var com2 = (await supabase.from("committees").select("name,monthly_amount").eq("id", session.pending_committee_id).single()).data;
        var updatedM = await getMembershipsByPhone(fromNumber);
        var regMsg = getMessage("registrationComplete", sessLang, { name: session.pending_member_name || "Member", committee: (com2 && com2.name) || "Committee", amount: (com2 && com2.monthly_amount) || 0 });
        if (updatedM.length > 1) { regMsg += "\n\n" + getMessage("multipleMemberships", sessLang, { count: updatedM.length, list: buildCommitteeList(updatedM), committee: (com2 && com2.name) || "Committee" }); }
        await clearSession(fromNumber);
        await reply(fromNumber, regMsg, isVoiceMessage);
      } else if (isNo(transcript)) {
        await clearSession(fromNumber);
        await reply(fromNumber, sessLang === "urdu" ? "رجسٹریشن منسوخ۔" : sessLang === "english" ? "Registration cancelled." : "Registration cancel ho gayi.", isVoiceMessage);
      } else { await reply(fromNumber, getMessage("rulesAcceptancePrompt", sessLang), isVoiceMessage); }
      return res.sendStatus(200);
    }

    if (session && session.state === "awaiting_payout_response") {
      var lower = transcript.toLowerCase().trim();
      var isSat = ["yes","haan","theek hai","ok","okay","satisfied"].some(function(p) { return lower.includes(p); });
      var wantCh = ["change","badlo","tabdeel"].some(function(p) { return lower.includes(p); });
      if (isSat) { await markPositionSatisfied(session.pending_position_id); await clearSession(fromNumber); await reply(fromNumber, "Position " + session.pending_position_number + " confirmed.", isVoiceMessage); return res.sendStatus(200); }
      if (wantCh) { await upsertSession(fromNumber, { state: "awaiting_change_reason", pending_committee_id: session.pending_committee_id, pending_order_id: session.pending_order_id, pending_position_id: session.pending_position_id, pending_position_number: session.pending_position_number, language: sessLang }); await reply(fromNumber, "Why do you want to change?", isVoiceMessage); return res.sendStatus(200); }
      await reply(fromNumber, "*Yes* ya *Change* likhein.", isVoiceMessage);
      return res.sendStatus(200);
    }

    if (session && session.state === "awaiting_change_reason") {
      var reason = transcript.trim();
      if (reason.length < 3) { await reply(fromNumber, "Mukammal wajah batayein.", isVoiceMessage); return res.sendStatus(200); }
      var order = await getActiveOrder(session.pending_committee_id);
      var allPos = (order && order.payout_positions) || [];
      var changeReq = await createChangeRequest({ payoutPositionId: session.pending_position_id, memberId: session.pending_member_id, reason: reason, currentPosition: session.pending_position_number, totalMembers: allPos.length, allPositions: allPos });
      await markPositionChangeRequested(session.pending_position_id);
      await clearSession(fromNumber);
      await reply(fromNumber, "Darkhwast record. AI: " + changeReq.ai_reasoning + " Naya tajawuz: " + changeReq.ai_suggested_position, isVoiceMessage);
      return res.sendStatus(200);
    }

    if (session && session.state === "awaiting_priority_voice") {
      var pText = transcript.trim();
      if (pText.length < 5) { await reply(fromNumber, "Tafseel se batayein.", isVoiceMessage); return res.sendStatus(200); }
      var pReq = await createPriorityRequest({ memberId: session.pending_member_id, committeeId: session.pending_committee_id, transcript: pText });
      await clearSession(fromNumber);
      var fLabel = pReq.ai_fairness_score >= 80 ? "High" : pReq.ai_fairness_score >= 60 ? "Moderate" : "Low";
      await reply(fromNumber, "AI: " + pReq.ai_category + " / " + pReq.ai_urgency + " Score: " + pReq.ai_fairness_score + "/100 (" + fLabel + ") " + (pReq.ai_suggested ? "Yes" : "No") + "\n" + pReq.ai_reasoning, isVoiceMessage);
      var otherM = (await supabase.from("members").select("phone,name").eq("committee_id", session.pending_committee_id).neq("id", session.pending_member_id)).data || [];
      var reqN = (await supabase.from("members").select("name").eq("id", session.pending_member_id).single()).data;
      var voteMsg = "[Aitbaar] " + (reqN && reqN.name || "Member") + " ne priority request bheji.\nDashboard par vote karein ya *Yes*/*No* likhein.";
      otherM.forEach(function(m) { if (m.phone) sendWhatsAppMessage(m.phone, voteMsg).catch(function() {}); });
      return res.sendStatus(200);
    }

    if (session && session.state === "awaiting_new_committee_code") {
      var codeMatch2 = transcript.match(COMMITTEE_CODE_PATTERN);
      if (!codeMatch2 && transcript.trim().length >= 4 && transcript.trim().length <= 12) { codeMatch2 = [transcript.trim().toUpperCase()]; }
      if (!codeMatch2) { await reply(fromNumber, getMessage("askCommitteeCode", sessLang), isVoiceMessage); return res.sendStatus(200); }
      var rawCode2 = codeMatch2[0].replace(/\s/g, "-").toUpperCase();
      var newCom = await findCommitteeByCode(rawCode2);
      if (!newCom) { await reply(fromNumber, getMessage("invalidCode", sessLang), isVoiceMessage); return res.sendStatus(200); }
      if (memberships.some(function(m) { return m.committee_id === newCom.id; })) { await clearSession(fromNumber); await reply(fromNumber, getMessage("alreadyMember", sessLang), isVoiceMessage); return res.sendStatus(200); }
      var knownName = memberships.length > 0 && memberships[0].name ? memberships[0].name : null;
      await upsertSession(fromNumber, { state: "awaiting_new_committee_confirm", pending_committee_id: newCom.id, pending_member_name: knownName, language: sessLang });
      await reply(fromNumber, getMessage("confirmRegistration", sessLang, { name: newCom.name, amount: newCom.monthly_amount || 0, members: newCom.total_members || "?" }), isVoiceMessage);
      return res.sendStatus(200);
    }

    if (session && session.state === "awaiting_new_committee_confirm") {
      if (isYes(transcript)) {
        var kn2 = session.pending_member_name || null;
        var regResult = await registerMemberToCommittee(fromNumber, session.pending_committee_id, kn2);
        if (regResult.error) { await clearSession(fromNumber); await reply(fromNumber, getMessage("registrationError", sessLang), isVoiceMessage); return res.sendStatus(200); }
        if (regResult.alreadyRegistered) { await clearSession(fromNumber); await reply(fromNumber, getMessage("alreadyMember", sessLang), isVoiceMessage); return res.sendStatus(200); }
        if (kn2) {
          await supabase.from("members").update({ name: kn2 }).eq("phone", fromNumber).eq("committee_id", session.pending_committee_id);
                   await upsertSession(fromNumber, { state: "awaiting_rules_acceptance", pending_committee_id: session.pending_committee_id, pending_member_id: regResult.member && regResult.member.id, pending_member_name: kn2, language: sessLang });
          await sendMemberRulesPdf(fromNumber, sessLang);
          await reply(fromNumber, getMessage("rulesAcceptancePrompt", sessLang), isVoiceMessage);
        } else {
          await upsertSession(fromNumber, { state: "awaiting_name", pending_committee_id: session.pending_committee_id, pending_member_id: regResult.member && regResult.member.id, language: sessLang });
          await reply(fromNumber, getMessage("askName", sessLang), isVoiceMessage);
        }
      } else if (isNo(transcript)) { await clearSession(fromNumber); await reply(fromNumber, "Registration cancelled.", isVoiceMessage); }
      else { await reply(fromNumber, "1 (Haan) ya 2 (Nahi) likhein.", isVoiceMessage); }
      return res.sendStatus(200);
    }

    // === REGISTERED MEMBER - MULTI-COMMITTEE INTENTS ===
    if (isRegistered) {
      console.log("Registered:", fromNumber, "Memberships:", memberships.length);

      if (detectJoinIntent(transcript)) {
        await upsertSession(fromNumber, { state: "awaiting_new_committee_code", language: sessLang });
        await reply(fromNumber, getMessage("joinAnother", sessLang), isVoiceMessage);
        return res.sendStatus(200);
      }

      // ── ORGANIZER-ONLY ACTION GUARD ──
      // If the message looks like an organizer-only action,
      // verify the sender is actually the organizer in the database.
      if (isOrganizerOnlyAction(transcript)) {
        // Find which committee(s) this member belongs to
        var targetCommitteeId = memberships[0] && memberships[0].committee_id;
        var organizer = await verifyOrganizer(fromNumber, targetCommitteeId);
        if (!organizer) {
          console.log("[AUTH] Organizer-only action denied for member:", fromNumber);
          var denyMsg = sessLang === "urdu"
            ? "\u0622\u067E\u0643\u0627 \u0646\u0645\u0628\u0631 \u0648\u06CC\u0631\u062A\u0648\u0627\u0644 \u0628\u0639\u0646\u0648\u0627\u0631 \u062A\u0635\u062F\u06CC\u0642 \u0646\u06D1\u0647\u06CC \u06D0 \u06D0\u0633 \u0627\u0633 \u0627\u0639\u0645\u0627\u0644 \u06A9\u0644\u06CC\u06D2 \u0644\u06CC\u06D2 \u0627\u0635\u0644 \u0627\u0648\u0631\u06AF\u0646\u0627\u0626\u0632\u0631 \u06A9\u06CC \u062A\u0635\u062F\u06CC\u0642 \u0632\u0648\u0631\u0648\u0631\u06CC \u0647\u0648\u061F"
            : sessLang === "english"
            ? "Your number is not verified as an organizer. This action requires authorized organizer verification."
            : "Aapka number organizer ke taur par verify nahi hai. Is action ke liye authorized organizer ki verification zaroori hai.";
          await reply(fromNumber, denyMsg, isVoiceMessage);
          return res.sendStatus(200);
        }
        console.log("[AUTH] Organizer action approved for:", fromNumber);
      }

      var intent = await detectIntent(transcript);
      console.log("Intent:", intent);

      if (intent.intent === "payment_confirmation" && intent.confidence === "high") {
        if (memberships.length > 1) {
          await upsertSession(fromNumber, { state: "awaiting_committee_selection_payment", language: sessLang });
          await reply(fromNumber, getMessage("memberCommitteesList", sessLang, { list: buildCommitteeList(memberships) }), isVoiceMessage);
          return res.sendStatus(200);
        }
        var sm = memberships[0];
        await savePaymentRecord({ memberId: sm.id, committeeId: sm.committee_id, amount: intent.amount });
        await reply(fromNumber, getMessage("pendingPayment", sessLang, { amount: intent.amount || "?", committee: (sm.committees && sm.committees.name) || "Committee" }), isVoiceMessage);
        var org3 = await supabase.from("organizers").select("phone").eq("id", sm.committees && sm.committees.organizer_id).maybeSingle();
        if (org3.data && org3.data.phone) { sendWhatsAppMessage(org3.data.phone, "[Aitbaar] " + (sm.name || fromNumber) + " ne payment claim ki.").catch(function() {}); }
        return res.sendStatus(200);
      }

      if (intent.intent === "trust_score_query") {
        if (memberships.length > 1) {
          await upsertSession(fromNumber, { state: "awaiting_committee_selection_trust", language: sessLang });
          await reply(fromNumber, getMessage("memberCommitteesList", sessLang, { list: buildCommitteeList(memberships) }), isVoiceMessage);
          return res.sendStatus(200);
        }
        var tm = memberships[0];
        var score = await getTrustScore(tm.id, tm.committee_id);
        var tmsg = score >= 80 ? "Excellent!" : score >= 50 ? "Good." : "Low - pay on time.";
        await reply(fromNumber, getMessage("trustScoreResponse", sessLang, { committee: (tm.committees && tm.committees.name) || "Committee", score: score, message: tmsg }), isVoiceMessage);
        return res.sendStatus(200);
      }

      if (intent.intent === "trust_score_explanation") {
        if (memberships.length > 1) {
          await upsertSession(fromNumber, { state: "awaiting_committee_selection_trust", language: sessLang });
          await reply(fromNumber, getMessage("memberCommitteesList", sessLang, { list: buildCommitteeList(memberships) }), isVoiceMessage);
          return res.sendStatus(200);
        }
        var explSvc = require("../services/trustScoreExplainerService");
        var expl = await explSvc.getFullExplanation(memberships[0].id, memberships[0].committee_id);
        await reply(fromNumber, explSvc.formatForWhatsApp(expl), isVoiceMessage);
        return res.sendStatus(200);
      }

      if (intent.intent === "priority_request") {
        if (memberships.length > 1) {
          await upsertSession(fromNumber, { state: "awaiting_committee_selection_priority", language: sessLang });
          await reply(fromNumber, getMessage("memberCommitteesList", sessLang, { list: buildCommitteeList(memberships) }), isVoiceMessage);
          return res.sendStatus(200);
        }
        var p3m = memberships[0];
        await upsertSession(fromNumber, { state: "awaiting_priority_voice", pending_committee_id: p3m.committee_id, pending_member_id: p3m.id, language: sessLang });
        await reply(fromNumber, getMessage("askPriorityReason", sessLang, { committee: (p3m.committees && p3m.committees.name) || "Committee" }), isVoiceMessage);
        return res.sendStatus(200);
      }

      var responseText = await generateResponse(transcript, memberships[0]);
      await saveMessage({ memberId: memberships[0].id, phone: fromNumber, transcript: transcript, response: responseText });
      await reply(fromNumber, responseText, isVoiceMessage);
      return res.sendStatus(200);
    }

    // === NEW USER ===
    var codeMatch3 = transcript.match(COMMITTEE_CODE_PATTERN);
    if (codeMatch3) {
      var rawCode3 = codeMatch3[0].replace(/\s/g, "-").toUpperCase();
      var committee3 = await findCommitteeByCode(rawCode3);
      if (!committee3) { await reply(fromNumber, getMessage("invalidCode", userLang), isVoiceMessage); return res.sendStatus(200); }
      var result3 = await registerMemberToCommittee(fromNumber, committee3.id);
      if (result3.error) { await reply(fromNumber, getMessage("registrationError", userLang), isVoiceMessage); return res.sendStatus(200); }
      await upsertSession(fromNumber, { state: "awaiting_name", pending_committee_id: committee3.id, pending_member_id: result3.member && result3.member.id, language: userLang });
      var wMsg = userLang === "urdu" ? "\"" + committee3.name + "\" mein khush amdeed! Apna naam batayein." : "Welcome to \"" + committee3.name + "\"! Please provide your name.";
      await reply(fromNumber, wMsg, isVoiceMessage);
      return res.sendStatus(200);
    }

    await reply(fromNumber, getMessage("welcome", userLang), isVoiceMessage);

  } catch (err) {
    console.error("Error handling message:", err.message);
  }
  return res.sendStatus(200);
});

module.exports = router;
