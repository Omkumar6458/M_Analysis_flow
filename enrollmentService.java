

package com.magicalid.abis.services;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;

/**
 * EnrollmentService — Business Logic Layer
 *
 * Called by: EnrollmentServlet ONLY.
 * Never called directly from frontend.
 *
 * NOW:    validates business rules + returns mock verified response
 * FUTURE: encrypts innerPayload + calls Master API + returns real response
 */
public class EnrollmentService {

    // =========================================================================
    // STEP 1 — VALIDATE BUSINESS RULES
    //
    // Called BEFORE building Master API payload.
    // Returns: null       → valid, proceed
    //          errorString → invalid, servlet returns error to browser
    // =========================================================================
    public String validateEnrollment(JsonNode demo, Map<String, String> imageMap) {

        // ── Applicant ID ──────────────────────────────────────────────────
        String applicantId = demo.path("applicantId").asText("").trim();
        if (applicantId.isEmpty()) {
            return "Applicant ID is required";
        }

        // ── Mandatory demographic fields ──────────────────────────────────
        String firstName = demo.path("firstName").asText("").trim();
        if (firstName.isEmpty()) {
            return "First name is required";
        }

        String lastName = demo.path("lastName").asText("").trim();
        if (lastName.isEmpty()) {
            return "Last name is required";
        }

        String dob = demo.path("dob").asText("").trim();
        if (dob.isEmpty()) {
            return "Date of birth is required";
        }

        String gender = demo.path("gender").asText("").trim();
        if (gender.isEmpty()) {
            return "Gender is required";
        }

        String group = demo.path("group").asText("").trim();
        if (group.isEmpty()) {
            return "Group is required";
        }

        // ── At least 1 biometric image received ───────────────────────────
        if (imageMap == null || imageMap.isEmpty()) {
            return "At least one biometric capture is required";
        }

        // ── Gender valid values ────────────────────────────────────────────
       /* if (!gender.equalsIgnoreCase("M") &&
            !gender.equalsIgnoreCase("F") &&
            !gender.equalsIgnoreCase("O")) {
            return "Gender must be M, F, or O";
        }
        */
        
     // ── Gender valid values ────────────────────────────────────────────────────────
        String genderNorm = gender.substring(0, 1).toUpperCase();
        if (!genderNorm.equals("M") && !genderNorm.equals("F") && !genderNorm.equals("O")) {
            return "Gender must be M, F, or O";
        }

        // ── Group valid values ─────────────────────────────────────────────
        if (!group.equalsIgnoreCase("Resident") &&
            !group.equalsIgnoreCase("Criminal") &&
            !group.equalsIgnoreCase("Others")) {
            return "Group must be Resident, Criminal, or Others";
        }

        // ── Date of birth format yyyy-MM-dd ───────────────────────────────
        if (!dob.matches("\\d{4}-\\d{2}-\\d{2}")) {
            return "Date of birth must be in format yyyy-MM-dd";
        }

        // ── All valid ─────────────────────────────────────────────────────
        return null;
    }

    // =========================================================================
    // STEP 2 — PROCESS ENROLLMENT
    //
    // Called AFTER validation passes + payload is built by servlet.
    //
    // NOW:    returns mock verified response JSON string
    // FUTURE: uncomment encryption + Master API call block
    //
    // Returns: JSON string → sent directly to browser by servlet
    // =========================================================================
    public String processEnrollment(JsonNode root, String builtPayload) {

        // Extract values to echo back in response
        String applicantId = root
            .path("innerPayload")
            .path("demographics")
            .path("applicantId")
            .asText("unknown");

        String reqId = root.path("reqId").asText("");
        String ts    = root.path("ts").asText("");

        int fingerCount = root.path("fingerCount").asInt(0);
        int irisCount   = root.path("irisCount").asInt(0);
        int faceCount   = root.path("faceCount").asInt(0);

        // =====================================================================
        // CURRENT: Return mock verified response
        // Matches Master API response format: ver, ec, em, reqId, ts + summary
        // =====================================================================
        return buildMockResponse(reqId, ts, applicantId, fingerCount, irisCount, faceCount);

        // =====================================================================
        // FUTURE: Uncomment when Master API is ready.
        // Delete the buildMockResponse() call above and use this block instead.
        // =====================================================================
        /*
        try {
            // A: Encrypt the innerPayload
            EncryptedPayload enc = encryptPayload(builtPayload);

            // B: Merge encrypted fields into outer envelope
            String finalJson = buildFinalJson(root, enc);

            // C: Get access token from session / config
            String accessToken    = getAccessToken();
            String subscriptionKey = getSubscriptionKey();

            // D: POST to Master API
            return callMasterApi(finalJson, accessToken, subscriptionKey);

        } catch (Exception e) {
            return buildErrorResponse("9999", "Encryption/Master API failed: " + e.getMessage());
        }
        */
    }

    // =========================================================================
    // HELPER: Build mock verified response JSON
    // =========================================================================
    private String buildMockResponse(String reqId, String ts,
                                      String applicantId,
                                      int fingerCount,
                                      int irisCount,
                                      int faceCount) {
        return "{"
            + q("ver")   + ":" + q("1.0") + ","
            + q("ec")    + ":" + q("0")   + ","
            + q("em")    + ":" + q("Payload verified successfully") + ","
            + q("reqId") + ":" + q(reqId) + ","
            + q("ts")    + ":" + q(ts)    + ","
            + q("summary") + ":{"
                + q("applicantId")          + ":" + q(applicantId)           + ","
                + q("demographicsReceived") + ":" + "true"                   + ","
                + q("fingerprintsReceived") + ":" + fingerCount               + ","
                + q("irisReceived")         + ":" + irisCount                 + ","
                + q("facesReceived")        + ":" + faceCount                 + ","
                + q("masterApiStatus")      + ":" + q("PENDING — not connected yet") + ","
                + q("status")              + ":" + q("VERIFIED — ready for Master API")
            + "}"
            + "}";
    }

    // =========================================================================
    // HELPER: Build error response in Master API format
    // =========================================================================
    private String buildErrorResponse(String ec, String em) {
        return "{"
            + q("ver") + ":" + q("1.0") + ","
            + q("ec")  + ":" + q(ec)    + ","
            + q("em")  + ":" + q(em)
            + "}";
    }

    // =========================================================================
    // HELPER: Wrap in JSON double-quotes
    // =========================================================================
    private String q(String s) {
        if (s == null) s = "";
        s = s.replace("\\", "\\\\").replace("\"", "\\\"");
        return "\"" + s + "\"";
    }

    // =========================================================================
    // FUTURE METHOD: Encrypt innerPayload for Master API (enc=1)
    // =========================================================================
    /*
    private EncryptedPayload encryptPayload(String innerPayload) throws Exception {

        // 1. Generate random AES-256 key
        KeyGenerator kg = KeyGenerator.getInstance("AES");
        kg.init(256, new SecureRandom());
        SecretKey aesKey = kg.generateKey();

        // 2. Encrypt innerPayload with AES/CBC/PKCS5Padding
        Cipher aesCipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        aesCipher.init(Cipher.ENCRYPT_MODE, aesKey);
        byte[] iv = aesCipher.getIV();
        byte[] encryptedData = aesCipher.doFinal(innerPayload.getBytes(StandardCharsets.UTF_8));
        String data = Base64.getEncoder().encodeToString(encryptedData);

        // 3. Encrypt AES key with Master API's RSA public key
        PublicKey rsaPublicKey = loadMasterApiPublicKey();
        Cipher rsaCipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        rsaCipher.init(Cipher.ENCRYPT_MODE, rsaPublicKey);
        String skey = Base64.getEncoder().encodeToString(
            rsaCipher.doFinal(aesKey.getEncoded())
        );

        // 4. HMAC-SHA256 of innerPayload
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(aesKey.getEncoded(), "HmacSHA256"));
        String hmac = Base64.getEncoder().encodeToString(
            mac.doFinal(innerPayload.getBytes(StandardCharsets.UTF_8))
        );

        // 5. ci = current date yyyyMMdd
        String ci = new SimpleDateFormat("yyyyMMdd").format(new Date());

        return new EncryptedPayload(skey, ci, hmac, data);
    }

    private PublicKey loadMasterApiPublicKey() throws Exception {
        InputStream is = getClass().getClassLoader()
                            .getResourceAsStream("masterapi_public.pem");
        String pem = new String(is.readAllBytes())
            .replace("-----BEGIN PUBLIC KEY-----", "")
            .replace("-----END PUBLIC KEY-----", "")
            .replaceAll("\\s", "");
        byte[] keyBytes = Base64.getDecoder().decode(pem);
        return KeyFactory.getInstance("RSA")
                         .generatePublic(new X509EncodedKeySpec(keyBytes));
    }

    private String callMasterApi(String jsonPayload,
                                   String accessToken,
                                   String subscriptionKey) throws Exception {
        URL url = new URL("https://<master-api-host>/applicant/enrol");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type",     "application/json");
        conn.setRequestProperty("access_token",     accessToken);
        conn.setRequestProperty("subscription-key", subscriptionKey);
        conn.setDoOutput(true);
        conn.setConnectTimeout(10_000);
        conn.setReadTimeout(20_000);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(jsonPayload.getBytes(StandardCharsets.UTF_8));
        }

        int status = conn.getResponseCode();
        InputStream is = (status == 200)
            ? conn.getInputStream()
            : conn.getErrorStream();

        return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }

    // Simple data class for encrypted fields
    private static class EncryptedPayload {
        final String skey, ci, hmac, data;
        EncryptedPayload(String skey, String ci, String hmac, String data) {
            this.skey = skey; this.ci = ci;
            this.hmac = hmac; this.data = data;
        }
    }
    */
}













