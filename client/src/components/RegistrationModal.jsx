import { useState } from "react";
import { registerOrganizer, createCommittee } from "../api/Committeeapi.js";
import "./RegistrationModal.css";

const API_BASE = "http://localhost:5000";

const POLICIES_EN = [
  { id: 1, title: "Data and Conversation Storage", text: "All conversations between members, organizers, and the Aitbaar bot may be securely stored in our database. This data will be used to provide better support, maintain committee records, and improve the accuracy of relevant services." },
  { id: 2, title: "Payment Record Storage", text: "All payment records submitted or verified through Aitbaar will be stored in the system. These records will be used to maintain accurate financial history and provide analytics through the organizer dashboard." },
  { id: 3, title: "Committee Creation Limit", text: "Each organizer can create and manage a maximum of 3 active committees at a time." },
  { id: 4, title: "Organizer Dashboard and Member Management", text: "The organizer will have access to a dashboard where they can view committee analytics, payment records, member information, trust scores, and other relevant data. The organizer may also remove members from a committee when necessary." },
  { id: 5, title: "Payment Verification and Trust Score", text: "The organizer must first verify and confirm a member's payment through the dashboard. Once the payment is confirmed, the member's trust score and relevant payment records will be updated accordingly." },
  { id: 6, title: "Committee WhatsApp Group", text: "The organizer may create a WhatsApp group for committee members to facilitate communication. Aitbaar may assist with relevant committee information, but members should follow the committee's established communication and approval procedures." },
  { id: 7, title: "Member Leaving the Committee", text: "Aitbaar is not responsible for losses, disputes, or financial consequences that may occur if a member voluntarily leaves a committee. Any remaining financial obligations should be handled according to the committee's agreed rules." },
  { id: 8, title: "Account Security", text: "Members and organizers are responsible for keeping their account credentials, authentication codes, and registered contact information secure. They should not share verification codes or login credentials with other people." },
  { id: 9, title: "Payment Responsibility", text: "Aitbaar records and displays payment information but does not guarantee that a payment has actually been made unless it has been properly verified through the system or by the authorized organizer." }
];

const POLICIES_UR = [
 { id: 1, title: "ڈیٹا اور گفتگو محفوظ کرنا", text: "آپ اعتبار بوٹ کے ساتھ جو بھی گفتگو کریں گے، وہ ہمارے ڈیٹا بیس میں محفوظ کی جا سکتی ہے۔ اس ڈیٹا کا استعمال آپ کو بہتر سہولت فراہم کرنے اور کمیٹی کا ریکارڈ برقرار رکھنے کے لیے کیا جائے گا۔8" },
  { id: 2, title: "ادائیگیوں کا ریکارڈ", text: "کمیٹی کی تمام ادائیگیوں کا ریکارڈ سسٹم میں محفوظ کیا جائے گا۔ ان ریکارڈز کی مدد سے آرگنائزر ڈیش بورڈ پر ادائیگیوں کی تاریخ اور مختلف تجزیات دیکھ سکے گا۔" },
  { id: 3, title: "کمیٹی بنانے کی حد", text: "ہر آرگنائزر ایک وقت میں زیادہ سے زیادہ 3 فعال کمیٹیاں بنا اور مینیج کر سکتا ہے۔" },
  { id: 4, title: "آرگنائزر ڈیش بورڈ", text: "آرگنائزر ڈیش بورڈ کے ذریعے کمیٹی کے ممبرز، ادائیگیاں، ٹرسٹ اسکور اور دیگر تجزیات دیکھ سکتا ہے۔ آرگنائزر ضرورت کے مطابق کسی ممبر کو کمیٹی سے نکال بھی سکتا ہے" },
  { id: 5, title: "ادائیگی کی تصدیق اور ٹرسٹ اسکور", text: "ممبر کی ادائیگی پہلے آرگنائزر ڈیش بورڈ سے تصدیق اور منظور کرے گا۔ ادائیگی کی تصدیق کے بعد ممبر کا ٹرسٹ اسکور اور ادائیگی کا ریکارڈ اپ ڈیٹ کیا جائے گا۔" },
  { id: 6, title: "کمیٹی واٹس ایپ گروپ", text: "آرگنائزر ممبرز کے ساتھ کمیٹی کا واٹس ایپ گروپ بنا سکتا ہے۔ اس گروپ کا استعمال کمیٹی سے متعلق گفتگو، معلومات اور ضروری اعلانات کے لیے کیا جا سکتا ہے۔" },
  { id: 7, title: "ممبر کے کمیٹی چھوڑنے کی صورت میں", text: "اگر کوئی ممبر اپنی مرضی سے کمیٹی چھوڑ دیتا ہے، تو اعتبار اس کے نتیجے میں ہونے والے کسی مالی نقصان، تنازع یا دیگر نقصان کا ذمہ دار نہیں ہوگا۔ باقی مالی ذمہ داریاں کمیٹی کے طے شدہ اصولوں کے مطابق پوری کی جائیں گی۔" },
  { id: 8, title: "اکاؤنٹ کی سیکیورٹی", text: "ممبرز اور آرگنائزر اپنے اکاؤنٹ، پاس ورڈ اور تصدیقی کوڈز کو محفوظ رکھنے کے ذمہ دار ہوں گے۔ پاس ورڈ یا او ٹی پی کسی دوسرے شخص کے ساتھ شیئر نہیں کرنا چاہیے۔" },
  { id: 9, title: "ادائیگی کی ذمہ داری", text: "اعتبار ادائیگیوں کا ریکارڈ رکھتا ہے اور دکھاتا ہے لیکن اسے یقین نہیں ہوتا کہ ادائیگی واقعی کی گئی ہے جب تک کہ وہ سسٹم یا منظور شدہ آرگنائزر کے ذریعے درست طور پر تصدیق نہ کر لے۔" },
  { id: 10, title: "فراڈ الرٹس", text: "اعتبار کی طرف سے دیا گیا فراڈ الرٹ صرف ایک انتباہ ہوگا، کسی ممبر پر حتمی طور پر فراڈ کا الزام نہیں ہوگا۔ مشکوک درخواست کی صورت میں ادائیگی کرنے سے پہلے معلومات کی تصدیق کرنا ضروری ہوگا۔" }
];


export default function RegistrationModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", password: "",
    committeeName: "", monthlyAmount: "", totalMembers: "",
    durationMonths: "", startDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [committeeCode, setCommitteeCode] = useState(null);
  const [committeeId, setCommitteeId] = useState(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [policiesLang, setPoliciesLang] = useState("en");

  if (!isOpen) return null;

  var activePolicies = policiesLang === "ur" ? POLICIES_UR : POLICIES_EN;

  function handleChange(e) { setFormData({ ...formData, [e.target.name]: e.target.value }); }

  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const registerData = await registerOrganizer({ name: formData.name, email: formData.email, phone: formData.phone, password: formData.password });
      if (!registerData || !registerData.organizer) throw new Error("Registration succeeded but no organizer data was returned.");
      const committeeData = await createCommittee({ organizerId: registerData.organizer.id, name: formData.committeeName, monthlyAmount: formData.monthlyAmount, totalMembers: formData.totalMembers, durationMonths: formData.durationMonths, startDate: formData.startDate });
      if (!committeeData || !committeeData.committee) throw new Error("Committee creation succeeded but no committee data was returned.");
      setCommitteeCode(committeeData.committee.code);
      setCommitteeId(committeeData.committee.id);
      setRulesLoading(true);
      try {
        await fetch(API_BASE + "/api/rules/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ committeeId: committeeData.committee.id, committeeConfig: { committeeName: formData.committeeName, monthlyAmount: parseInt(formData.monthlyAmount), totalMembers: parseInt(formData.totalMembers), durationMonths: parseInt(formData.durationMonths), startDate: formData.startDate } }) });
      } catch (rulesErr) { console.error("Rules generation failed:", rulesErr); } finally { setRulesLoading(false); }
    } catch (err) { console.error("Registration flow error:", err); setError(err.message); } finally { setLoading(false); }
  }

  function handleDownloadPdf() {
    if (!committeeId) return;
    var params = new URLSearchParams({ name: formData.committeeName, amount: formData.monthlyAmount, members: formData.totalMembers, duration: formData.durationMonths, startDate: formData.startDate });
    window.open(API_BASE + "/api/rules/" + committeeId + "/pdf?" + params, "_blank");
  }

  async function handleSendWhatsApp() {
    if (!committeeId) return; setSendingWhatsApp(true);
    try {
      var res = await fetch(API_BASE + "/api/rules/" + committeeId + "/send-whatsapp?role=member");
      var data = await res.json();
      if (data.whatsappSummary) { await navigator.clipboard.writeText(data.whatsappSummary); alert("Rules copied to clipboard! Paste them in your WhatsApp group."); }
    } catch (err) { console.error("WhatsApp send failed:", err); } finally { setSendingWhatsApp(false); }
  }

  function handleClose() {
    setFormData({ name: "", email: "", phone: "", password: "", committeeName: "", monthlyAmount: "", totalMembers: "", durationMonths: "", startDate: "" });
    setCommitteeCode(null); setCommitteeId(null); setError(""); setTermsAccepted(false); setPoliciesLang("en"); onClose();
  }

  function renderPolicies(list) {
    return list.map(function(p) {
      return <div key={p.id} className="terms-preview-item"><span className="terms-check">{p.id}.</span> <span><strong>{p.title}</strong> — {p.text}</span></div>;
    });
  }

  function renderRulesCards(list) {
    return list.map(function(p) {
      return <div key={p.id} className="rule-card"><div className="rule-card-header"><span className="rule-icon">{p.id}.</span><span className="rule-title">{p.title}</span></div><p className="rule-text">{p.text}</p></div>;
    });
  }

  var checkboxLabel = policiesLang === "ur"
    ?  "میں نے اوپر دی گئی اعتبار کمیٹی کی تمام پالیسیز پڑھ لی ہیں اور ان سے اتفاق کرتا/کرتی ہوں۔ مجھے سمجھ ہے کہ یہ پالیسیاں اس کمیٹی پر لاگو ہوتی ہیں اور تمام ممبرز کے لیے قابلِ عمل ہیں۔"
    : "I have read and agree to the Aitbaar Committee Policies above. I understand these policies govern this committee and apply to all members.";

  return (
    <div className="modal-overlay"><div className="modal-box">
      <button onClick={handleClose} className="modal-close">&times;</button>
      {!committeeCode ? (
        <><h3 className="modal-title font-display">Create your committee</h3>
        <p className="modal-subtitle">Fill in your details and your committee details.</p>
        <form onSubmit={handleSubmit} className="form-body">
          <p className="form-section-label">Your details</p>
          <input required name="name" placeholder="Full name" className="form-input" value={formData.name} onChange={handleChange} />
          <input required name="email" type="email" placeholder="Email address" className="form-input" value={formData.email} onChange={handleChange} />
          <input required name="phone" placeholder="Phone number" className="form-input" value={formData.phone} onChange={handleChange} />
          <input required name="password" type="password" placeholder="Create a password" className="form-input" value={formData.password} onChange={handleChange} />
          <p className="form-section-label" style={{paddingTop:"0.75rem"}}>Committee details</p>
          <input required name="committeeName" placeholder="Committee name" className="form-input" value={formData.committeeName} onChange={handleChange} />
          <div className="form-row">
            <input required name="monthlyAmount" type="number" placeholder="Monthly amount (Rs)" className="form-input" value={formData.monthlyAmount} onChange={handleChange} />
            <input required name="totalMembers" type="number" placeholder="Total members" className="form-input" value={formData.totalMembers} onChange={handleChange} />
          </div>
          <div className="form-row">
            <input required name="durationMonths" type="number" placeholder="Duration (months)" className="form-input" value={formData.durationMonths} onChange={handleChange} />
            <input required name="startDate" type="date" className="form-input" value={formData.startDate} onChange={handleChange} />
          </div>
          <div className="terms-preview-section">
            <div className="terms-preview-header">
              <span className="terms-preview-icon">📋</span>
              <span className="terms-preview-title">Aitbaar Committee Policies</span>
              <div className="lang-toggle">
                <button type="button" className={"lang-btn "+(policiesLang==="en"?"active":"")} onClick={function(){setPoliciesLang("en");}}>English</button>
                <button type="button" className={"lang-btn "+(policiesLang==="ur"?"active":"")} onClick={function(){setPoliciesLang("ur");}}>{"\u0627\u0631\u062f\u0648"}</button>
              </div>
            </div>
            <div className="terms-preview-list" style={policiesLang==="ur"?{direction:"rtl",textAlign:"right"}:{}}>
              {renderPolicies(activePolicies, policiesLang==="ur")}
            </div>
            <label className="terms-checkbox terms-checkbox-form">
              <input type="checkbox" checked={termsAccepted} onChange={function(e){setTermsAccepted(e.target.checked);}} />
              <span className="terms-checkbox-text">{checkboxLabel}</span>
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={loading || !termsAccepted} className="form-submit">{loading ? "Creating..." : "Create committee"}</button>
        </form></>
      ) : (
        <div className="success-box">
          <div className="success-icon">&#10003;</div>
          <h3 className="success-title font-display">You are connected to Aitbaar</h3>
          <p className="success-subtitle">Share this code with your committee members on WhatsApp.</p>
          <div className="success-code font-display">{committeeCode}</div>
          <p className="success-note">We have also emailed this code to you for safekeeping.</p>
          <div className="rules-section">
            <div className="terms-preview-header">
              <span className="terms-preview-icon">📋</span>
              <span className="terms-preview-title">Aitbaar Committee Policies</span>
              <div className="lang-toggle">
                <button className={"lang-btn "+(policiesLang==="en"?"active":"")} onClick={function(){setPoliciesLang("en");}}>English</button>
                <button className={"lang-btn "+(policiesLang==="ur"?"active":"")} onClick={function(){setPoliciesLang("ur");}}>{"\u0627\u0631\u062f\u0648"}</button>
              </div>
            </div>
            <div className="rules-cards" style={policiesLang==="ur"?{direction:"rtl",textAlign:"right"}:{}}>
              {renderRulesCards(activePolicies, policiesLang==="ur")}
            </div>
            <div className="rules-actions">
              <button className="rules-btn rules-btn-pdf" onClick={handleDownloadPdf} disabled={rulesLoading}>{"\ud83d\udcc4"} Download PDF</button>
              <button className="rules-btn rules-btn-whatsapp" onClick={handleSendWhatsApp} disabled={rulesLoading || sendingWhatsApp}>{"\ud83d\udcf1"} {rulesLoading ? "Generating Rules..." : "Send Rules"}</button>
            </div>
          </div>
          <button onClick={handleClose} className="success-done-btn">Done</button>
        </div>
      )}
    </div></div>
  );
}
