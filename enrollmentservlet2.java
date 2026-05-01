

*/

package com.magicalid.abis.servlets;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.magicalid.abis.services.EnrollmentService;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.util.*;

/**
 * EnrollmentServlet — HTTP Layer
 *
 * Receives multipart/form-data from JS frontend.
 * Parses JSON + image files.
 * Validates format.
 * Builds sysInfo + Master API payload.
 * Calls EnrollmentService for business logic.
 * Returns JSON response to browser.
 *
 * URL: POST /app/enrollment
 */
@MultipartConfig(
    maxFileSize    = 5 * 1024 * 1024,   // 5 MB per file
    maxRequestSize = 30 * 1024 * 1024   // 30 MB total
)
public class EnrollmentServlet extends HttpServlet {

    private final EnrollmentService enrollmentService = new EnrollmentService();
    private final ObjectMapper mapper = new ObjectMapper();

    // =========================================================================
    // POST — main entry point
    // =========================================================================
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        // ------------------------------------------------------------------
        // STEP 1: Read "json" text part sent by JS
        // ------------------------------------------------------------------
        String jsonPart = request.getParameter("json");
        if (jsonPart == null || jsonPart.isBlank()) {
            sendError(response, "2001", "Missing json parameter");
            return;
        }

        // ------------------------------------------------------------------
        // STEP 2: Parse JSON → JsonNode tree
        // ------------------------------------------------------------------
        JsonNode root;
        try {
            root = mapper.readTree(jsonPart);
        } catch (Exception e) {
            sendError(response, "2001", "Invalid JSON: " + e.getMessage());
            return;
        }

        JsonNode inner = root.path("innerPayload");
        JsonNode demo  = inner.path("demographics");

        // ------------------------------------------------------------------
        // STEP 3: Validate outer envelope fields
        // ------------------------------------------------------------------
        List<String> errors = new ArrayList<>();

        if (root.path("ver").isMissingNode())     errors.add("ver is required");
        if (root.path("reqId").isMissingNode())   errors.add("reqId is required");
        if (root.path("ts").isMissingNode())      errors.add("ts is required");
        if (root.path("enc").isMissingNode())     errors.add("enc is required");
        if (root.path("mode").isMissingNode())    errors.add("mode is required");

        if (!errors.isEmpty()) {
            sendError(response, "2001", String.join(" | ", errors));
            return;
        }

        // ------------------------------------------------------------------
        // STEP 4: Read image files → Base64
        //
        // JS names the parts like: "faceFront", "irisLeft", "fp_left_thumb"
        // We read each Part and encode to Base64
        // ------------------------------------------------------------------
        Map<String, String> imageMap = new LinkedHashMap<>();

        // Face images
        readImagePart(request, "faceFront",  imageMap);
        readImagePart(request, "faceFront_right", imageMap);
        readImagePart(request, "faceLeft",   imageMap);

        // Iris images
        readImagePart(request, "irisLeft",   imageMap);
        readImagePart(request, "irisRight",  imageMap);

        // Fingerprint images — left hand
        readImagePart(request, "fp_left_thumb",  imageMap);
        readImagePart(request, "fp_left_index",  imageMap);
        readImagePart(request, "fp_left_middle", imageMap);
        readImagePart(request, "fp_left_ring",   imageMap);
        readImagePart(request, "fp_left_little", imageMap);

        // Fingerprint images — right hand
        readImagePart(request, "fp_right_thumb",  imageMap);
        readImagePart(request, "fp_right_index",  imageMap);
        readImagePart(request, "fp_right_middle", imageMap);
        readImagePart(request, "fp_right_ring",   imageMap);
        readImagePart(request, "fp_right_little", imageMap);

        // ------------------------------------------------------------------
        // STEP 5: Validate counts match actual files received
        // ------------------------------------------------------------------
        int declaredFingerCount = root.path("fingerCount").asInt(0);
        int declaredIrisCount   = root.path("irisCount").asInt(0);
        int declaredFaceCount   = root.path("faceCount").asInt(0);

        long actualFP   = imageMap.keySet().stream().filter(k -> k.startsWith("fp_")).count();
        long actualIris = imageMap.keySet().stream().filter(k -> k.startsWith("iris")).count();
        long actualFace = imageMap.keySet().stream()
                            .filter(k -> k.startsWith("face") || k.equals("faceFront")).count();

        if (declaredFingerCount != actualFP) {
            errors.add("fingerCount=" + declaredFingerCount + " but received " + actualFP + " fingerprint files");
        }
        if (declaredIrisCount != actualIris) {
            errors.add("irisCount=" + declaredIrisCount + " but received " + actualIris + " iris files");
        }
        if (declaredFaceCount != actualFace) {
            errors.add("faceCount=" + declaredFaceCount + " but received " + actualFace + " face files");
        }

        if (!errors.isEmpty()) {
            sendError(response, "2003", String.join(" | ", errors));
            return;
        }

        // ------------------------------------------------------------------
        // STEP 6: Call EnrollmentService — validate business rules
        // ------------------------------------------------------------------
        String validationError = enrollmentService.validateEnrollment(demo, imageMap);
        if (validationError != null) {
            sendError(response, "2002", validationError);
            return;
        }

        // ------------------------------------------------------------------
        // STEP 7: Build sysInfo from server (os, ip, arch)
        // ------------------------------------------------------------------
        String sysInfoJson = buildSysInfo(request);

        // ------------------------------------------------------------------
        // STEP 8: Build complete Master API payload (innerPayload)
        //         Inserts Base64 images into bioData[].data
        // ------------------------------------------------------------------
        String masterPayload = buildMasterPayload(root, inner, demo, sysInfoJson, imageMap);

        // ------------------------------------------------------------------
        // STEP 9: Call EnrollmentService — process (mock response for now)
        // ------------------------------------------------------------------
        String serviceResponse = enrollmentService.processEnrollment(root, masterPayload);

        // ------------------------------------------------------------------
        // STEP 10: Return response to browser
        // ------------------------------------------------------------------
        response.setStatus(HttpServletResponse.SC_OK);
        PrintWriter out = response.getWriter();
        out.print(serviceResponse);
        out.flush();
    }

    // =========================================================================
    // HELPER: Read one image Part → Base64 string → store in map
    // =========================================================================
    private void readImagePart(HttpServletRequest request,
                                String partName,
                                Map<String, String> imageMap) {
        try {
            Part part = request.getPart(partName);
            if (part == null || part.getSize() == 0) return;

            InputStream is = part.getInputStream();
            byte[] bytes = is.readAllBytes();
            String base64 = Base64.getEncoder().encodeToString(bytes);
            imageMap.put(partName, base64);

        } catch (Exception e) {
            // Part not present — skip silently
        }
    }

    // =========================================================================
    // HELPER: Build sysInfo JSON from server environment
    //
    // os, osv, arch  → from JVM System.getProperty()
    // localIp        → server's LAN IP
    // publIp         → client's real internet IP (from request headers)
    // =========================================================================
    private String buildSysInfo(HttpServletRequest request) {

        String os   = System.getProperty("os.name",    "Unknown");
        String osv  = System.getProperty("os.version", "Unknown");
        String arch = System.getProperty("os.arch",    "Unknown");
        arch = arch.contains("64") ? "64bit" : "32bit";

        // Server local IP
        String localIp = "unknown";
        try {
            localIp = InetAddress.getLocalHost().getHostAddress();
        } catch (Exception ignored) {}

        // Client public IP — check proxy headers first
        String publIp = request.getHeader("X-Forwarded-For");
        if (publIp == null || publIp.isBlank()) {
            publIp = request.getHeader("X-Real-IP");
        }
        if (publIp == null || publIp.isBlank()) {
            publIp = request.getRemoteAddr();
        }
        // X-Forwarded-For can be "client, proxy1, proxy2" — take first
        if (publIp != null && publIp.contains(",")) {
            publIp = publIp.split(",")[0].trim();
        }

        return "{"
            + q("os")      + ":" + q(os)      + ","
            + q("osv")     + ":" + q(osv)     + ","
            + q("arch")    + ":" + q(arch)    + ","
            + q("appType") + ":" + q("Web")   + ","
            + q("localIp") + ":" + q(localIp) + ","
            + q("publIp")  + ":" + q(publIp)  + ","
            + q("others")  + ":" + q("")
            + "}";
    }

    // =========================================================================
    // HELPER: Build the complete innerPayload JSON
    //
    // Structure matches Master API spec exactly:
    //   ts, sysInfo, demographics, fingerprints{bioData[]}, irises{bioData[]}, faces{bioData[]}
    //
    // bioData[].data = Base64 image string
    // bioData[].format = image extension (JPEG/PNG/BMP)
    // bioData[].pos = finger position (1-10) or iris side (L/R) or face angle
    // =========================================================================
    private String buildMasterPayload(JsonNode root,
                                       JsonNode inner,
                                       JsonNode demo,
                                       String sysInfoJson,
                                       Map<String, String> imageMap) {
        StringBuilder sb = new StringBuilder();

        String ts    = root.path("ts").asText("");
        String reqId = root.path("reqId").asText("");

        // -- Outer envelope (non-encrypted fields) --------------------------
        // NOTE: In future these wrap around encrypted "data" field.
        // For now we build the full innerPayload as plain JSON.

        sb.append("{");
        sb.append(q("ver")).append(":").append(q(root.path("ver").asText("1.0"))).append(",");
        sb.append(q("reqId")).append(":").append(q(reqId)).append(",");
        sb.append(q("ts")).append(":").append(q(ts)).append(",");
        sb.append(q("enc")).append(":").append(root.path("enc").asInt(1)).append(",");
        sb.append(q("mode")).append(":").append(root.path("mode").asInt(1)).append(",");
        sb.append(q("demoCount")).append(":").append(root.path("demoCount").asInt(0)).append(",");
        sb.append(q("fingerCount")).append(":").append(root.path("fingerCount").asInt(0)).append(",");
        sb.append(q("irisCount")).append(":").append(root.path("irisCount").asInt(0)).append(",");
        sb.append(q("faceCount")).append(":").append(root.path("faceCount").asInt(0)).append(",");

        // skey, ci, hmac, data → FUTURE (encryption) — empty for now
        sb.append(q("skey")).append(":").append(q("")).append(",");
        sb.append(q("ci")).append(":").append(q("")).append(",");
        sb.append(q("hmac")).append(":").append(q("")).append(",");

        // -- innerPayload (this will become "data" field after encryption) --
        sb.append(q("innerPayload")).append(":{");

        // ts inside innerPayload
        sb.append(q("ts")).append(":").append(q(ts)).append(",");

        // sysInfo (server-side built)
        sb.append(q("sysInfo")).append(":").append(sysInfoJson).append(",");

        // demographics — copy all fields from JS
        sb.append(q("demographics")).append(":{");
        sb.append(q("applicantId")).append(":").append(q(demo.path("applicantId").asText(""))).append(",");
        sb.append(q("group")).append(":").append(q(demo.path("group").asText(""))).append(",");
        sb.append(q("firstName")).append(":").append(q(demo.path("firstName").asText(""))).append(",");
        sb.append(q("middleName")).append(":").append(q(demo.path("middleName").asText(""))).append(",");
        sb.append(q("lastName")).append(":").append(q(demo.path("lastName").asText(""))).append(",");
        sb.append(q("givenNames")).append(":").append(q(demo.path("givenNames").asText(""))).append(",");
        sb.append(q("nickName")).append(":").append(q(demo.path("nickName").asText(""))).append(",");
        sb.append(q("spouseName")).append(":").append(q(demo.path("spouseName").asText(""))).append(",");
        sb.append(q("dob")).append(":").append(q(demo.path("dob").asText(""))).append(",");
        sb.append(q("placeOfBirth")).append(":").append(q(demo.path("placeOfBirth").asText(""))).append(",");
        sb.append(q("gender")).append(":").append(q(demo.path("gender").asText(""))).append(",");
        sb.append(q("mob")).append(":").append(q(
            demo.path("mobileCountryCode").asText("") + " " + demo.path("mobileNumber").asText("")
        )).append(",");
        sb.append(q("tel")).append(":").append(q(
            demo.path("telephoneCountryCode").asText("") + " " + demo.path("telephoneNo").asText("")
        )).append(",");
        sb.append(q("maritalStatus")).append(":").append(q(demo.path("maritalStatus").asText(""))).append(",");
        sb.append(q("motherName")).append(":").append(q(demo.path("motherName").asText(""))).append(",");
        sb.append(q("fatherName")).append(":").append(q(demo.path("fatherName").asText(""))).append(",");
        sb.append(q("city")).append(":").append(q(demo.path("city").asText(""))).append(",");
        sb.append(q("state")).append(":").append(q(demo.path("state").asText(""))).append(",");
        sb.append(q("country")).append(":").append(q(demo.path("country").asText(""))).append(",");
        sb.append(q("address")).append(":").append(q(demo.path("address").asText(""))).append(",");
        sb.append(q("permanentCity")).append(":").append(q(demo.path("permanentCity").asText(""))).append(",");
        sb.append(q("permanentState")).append(":").append(q(demo.path("permanentState").asText(""))).append(",");
        sb.append(q("permanentCountry")).append(":").append(q(demo.path("permanentCountry").asText(""))).append(",");
        sb.append(q("permanentAddress")).append(":").append(q(demo.path("permanentAddress").asText(""))).append(",");
        sb.append(q("height")).append(":").append(q(demo.path("height").asText(""))).append(",");
        sb.append(q("weight")).append(":").append(q(demo.path("weight").asText(""))).append(",");
        sb.append(q("eyesColor")).append(":").append(q(demo.path("eyesColor").asText(""))).append(",");
        sb.append(q("hairColor")).append(":").append(q(demo.path("hairColor").asText(""))).append(",");
        sb.append(q("voice")).append(":").append(q(demo.path("voice").asText(""))).append(",");
        sb.append(q("faceFeatures")).append(":").append(q(demo.path("faceFeatures").asText(""))).append(",");
        sb.append(q("faceMarks")).append(":").append(q(demo.path("faceMarks").asText(""))).append(",");
        sb.append(q("torsoMarks")).append(":").append(q(demo.path("torsoMarks").asText(""))).append(",");
        sb.append(q("limbsMarks")).append(":").append(q(demo.path("limbsMarks").asText(""))).append(",");
        sb.append(q("otherNotes")).append(":").append(q(demo.path("otherNotes").asText("")));
        sb.append("},"); // end demographics

        // fingerprints
        sb.append(q("fingerprints")).append(":{");
        sb.append(q("model")).append(":").append(q("MATISX")).append(",");
        sb.append(q("srNo")).append(":").append(q("9199894")).append(",");
        sb.append(q("bioData")).append(":[");
        boolean firstFP = true;

        // Position mapping: left hand pos 1-5, right hand pos 6-10
        String[][] fpSlots = {
            {"fp_left_thumb",  "1", "L_THUMB"},
            {"fp_left_index",  "2", "L_INDEX"},
            {"fp_left_middle", "3", "L_MIDDLE"},
            {"fp_left_ring",   "4", "L_RING"},
            {"fp_left_little", "5", "L_LITTLE"},
            {"fp_right_thumb", "6", "R_THUMB"},
            {"fp_right_index", "7", "R_INDEX"},
            {"fp_right_middle","8", "R_MIDDLE"},
            {"fp_right_ring",  "9", "R_RING"},
            {"fp_right_little","10","R_LITTLE"}
        };

        for (String[] slot : fpSlots) {
            String key = slot[0], pos = slot[1];
            String base64 = imageMap.getOrDefault(key, "");
            if (base64.isEmpty()) continue; // skip fingers not captured

            if (!firstFP) sb.append(",");
            firstFP = false;

            sb.append("{");
            sb.append(q("format")).append(":").append("2").append(",");   // 2 = JPEG per spec
            sb.append(q("wd")).append(":").append("256").append(",");
            sb.append(q("ht")).append(":").append("360").append(",");
            sb.append(q("pos")).append(":").append(q(pos)).append(",");
            sb.append(q("data")).append(":").append(q(base64)).append(",");
            sb.append(q("qty")).append(":").append("20").append(",");
            sb.append(q("nfiq2")).append(":").append("35");
            sb.append("}");
        }
        sb.append("]},"); // end fingerprints

        // irises
        sb.append(q("irises")).append(":{");
        sb.append(q("model")).append(":").append(q("MATISX")).append(",");
        sb.append(q("srNo")).append(":").append(q("9199894")).append(",");
        sb.append(q("bioData")).append(":[");
        boolean firstIris = true;

        String[][] irisSlots = {
            {"irisLeft",  "L"},
            {"irisRight", "R"}
        };
        for (String[] slot : irisSlots) {
            String base64 = imageMap.getOrDefault(slot[0], "");
            if (base64.isEmpty()) continue;

            if (!firstIris) sb.append(",");
            firstIris = false;

            sb.append("{");
            sb.append(q("format")).append(":").append("2").append(",");
            sb.append(q("wd")).append(":").append("256").append(",");
            sb.append(q("ht")).append(":").append("360").append(",");
            sb.append(q("pos")).append(":").append(q(slot[1])).append(",");
            sb.append(q("data")).append(":").append(q(base64)).append(",");
            sb.append(q("qty")).append(":").append("20");
            sb.append("}");
        }
        sb.append("]},"); // end irises

        // faces
        sb.append(q("faces")).append(":{");
        sb.append(q("model")).append(":").append(q("MATISX")).append(",");
        sb.append(q("srNo")).append(":").append(q("9199894")).append(",");
        sb.append(q("bioData")).append(":[");
        boolean firstFace = true;

        String[][] faceSlots = {
            {"faceFront",       "FRONT"},
            {"faceFront_right", "RIGHT"},
            {"faceLeft",        "LEFT"}
        };
        for (String[] slot : faceSlots) {
            String base64 = imageMap.getOrDefault(slot[0], "");
            if (base64.isEmpty()) continue;

            if (!firstFace) sb.append(",");
            firstFace = false;

            sb.append("{");
            sb.append(q("format")).append(":").append("2").append(",");
            sb.append(q("wd")).append(":").append("256").append(",");
            sb.append(q("ht")).append(":").append("360").append(",");
            sb.append(q("pos")).append(":").append(q(slot[1])).append(",");
            sb.append(q("data")).append(":").append(q(base64));
            sb.append("}");
        }
        sb.append("]}"); // end faces

        sb.append("}"); // end innerPayload
        sb.append("}"); // end root

        return sb.toString();
    }

    // =========================================================================
    // HELPER: Send error JSON response
    // =========================================================================
    private void sendError(HttpServletResponse response, String ec, String em)
            throws IOException {
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        PrintWriter out = response.getWriter();
        out.print("{" + q("ver") + ":" + q("1.0") + ","
                     + q("ec")  + ":" + q(ec)     + ","
                     + q("em")  + ":" + q(em)
                + "}");
        out.flush();
    }

    // =========================================================================
    // HELPER: Wrap string in JSON double-quotes, escaping special chars
    // =========================================================================
    private String q(String s) {
        if (s == null) s = "";
        s = s.replace("\\", "\\\\")
             .replace("\"", "\\\"")
             .replace("\n", "\\n")
             .replace("\r", "\\r")
             .replace("\t", "\\t");
        return "\"" + s + "\"";
    }
}






