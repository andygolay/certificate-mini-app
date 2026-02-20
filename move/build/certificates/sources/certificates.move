module certificates::certificates {
    use std::signer;
    use std::string::String;
    use std::vector;

    /// Template for a type of certificate (e.g. "University Diploma 2025")
    struct Template has copy, drop, store {
        name: String,
        description: String,
    }

    /// A single issued certificate (NFT-like), stored under the issuer's data
    struct Certificate has copy, drop, store {
        template_index: u64,
        recipient: address,
        student_name: String,
        class_name: String,
        grades: String,
    }

    /// Reference to a certificate: (issuer address, index in issuer's list)
    struct CertRef has copy, drop, store {
        issuer: address,
        index: u64,
    }

    /// Issuer's on-chain data: templates they created and certificates they issued
    struct IssuerData has key {
        templates: vector<Template>,
        certificates: vector<Certificate>,
    }

    /// Recipient's list of certificate references (claimed certificates)
    struct RecipientCertificates has key {
        refs: vector<CertRef>,
    }

    /// Create template (issuer only). Caller becomes issuer.
    public entry fun create_template(
        account: &signer,
        name: String,
        description: String,
    ) acquires IssuerData {
        let addr = signer::address_of(account);
        if (!exists<IssuerData>(addr)) {
            move_to(account, IssuerData {
                templates: vector::empty(),
                certificates: vector::empty(),
            });
        };
        let data = borrow_global_mut<IssuerData>(addr);
        vector::push_back(&mut data.templates, Template { name, description });
    }

    /// Issue a certificate to a recipient (issuer only). Recipient must later claim it.
    public entry fun issue_certificate(
        issuer: &signer,
        template_index: u64,
        recipient: address,
        student_name: String,
        class_name: String,
        grades: String,
    ) acquires IssuerData {
        let issuer_addr = signer::address_of(issuer);
        assert!(exists<IssuerData>(issuer_addr), 1); // Issuer not initialized
        let data = borrow_global<IssuerData>(issuer_addr);
        assert!(template_index < vector::length(&data.templates), 2); // Invalid template index
        let data = borrow_global_mut<IssuerData>(issuer_addr);
        vector::push_back(&mut data.certificates, Certificate {
            template_index,
            recipient,
            student_name,
            class_name,
            grades,
        });
    }

    /// Claim a certificate (recipient only). Verifies the certificate was issued to this recipient.
    public entry fun claim_certificate(
        recipient: &signer,
        issuer: address,
        cert_index: u64,
    ) acquires IssuerData, RecipientCertificates {
        let recipient_addr = signer::address_of(recipient);
        assert!(exists<IssuerData>(issuer), 3); // Issuer has no data
        let data = borrow_global<IssuerData>(issuer);
        assert!(cert_index < vector::length(&data.certificates), 4); // Invalid cert index
        let cert = vector::borrow(&data.certificates, cert_index);
        assert!(cert.recipient == recipient_addr, 5); // Certificate not for this recipient

        if (!exists<RecipientCertificates>(recipient_addr)) {
            move_to(recipient, RecipientCertificates {
                refs: vector::empty(),
            });
        };
        let rec = borrow_global_mut<RecipientCertificates>(recipient_addr);
        vector::push_back(&mut rec.refs, CertRef { issuer, index: cert_index });
    }

    // ========== View functions ==========

    #[view]
    /// Check if issuer has initialized their data
    public fun is_issuer(addr: address): bool {
        exists<IssuerData>(addr)
    }

    #[view]
    /// Get number of templates for an issuer
    public fun get_template_count(issuer: address): u64 acquires IssuerData {
        if (!exists<IssuerData>(issuer)) return 0;
        vector::length(&borrow_global<IssuerData>(issuer).templates)
    }

    #[view]
    /// Get template at index (name, description)
    public fun get_template(issuer: address, index: u64): (String, String) acquires IssuerData {
        assert!(exists<IssuerData>(issuer), 1);
        let data = borrow_global<IssuerData>(issuer);
        assert!(index < vector::length(&data.templates), 2);
        let t = vector::borrow(&data.templates, index);
        (t.name, t.description)
    }

    #[view]
    /// Get number of certificates issued by an issuer
    public fun get_certificate_count(issuer: address): u64 acquires IssuerData {
        if (!exists<IssuerData>(issuer)) return 0;
        vector::length(&borrow_global<IssuerData>(issuer).certificates)
    }

    #[view]
    /// Get a single certificate by issuer and index
    public fun get_certificate(issuer: address, index: u64): (u64, address, String, String, String) acquires IssuerData {
        assert!(exists<IssuerData>(issuer), 1);
        let data = borrow_global<IssuerData>(issuer);
        assert!(index < vector::length(&data.certificates), 2);
        let c = vector::borrow(&data.certificates, index);
        (c.template_index, c.recipient, c.student_name, c.class_name, c.grades)
    }

    #[view]
    /// Get number of certificates claimed by a recipient
    public fun get_recipient_cert_count(recipient: address): u64 acquires RecipientCertificates {
        if (!exists<RecipientCertificates>(recipient)) return 0;
        vector::length(&borrow_global<RecipientCertificates>(recipient).refs)
    }

    #[view]
    /// Get a cert ref for a recipient at index (issuer, cert_index)
    public fun get_recipient_cert_ref(recipient: address, index: u64): (address, u64) acquires RecipientCertificates {
        assert!(exists<RecipientCertificates>(recipient), 1);
        let rec = borrow_global<RecipientCertificates>(recipient);
        assert!(index < vector::length(&rec.refs), 2);
        let r = vector::borrow(&rec.refs, index);
        (r.issuer, r.index)
    }
}
