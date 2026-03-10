require('dotenv').config();
const express = require('express');
const midtransClient = require('midtrans-client');
const db = require('./db'); 
const bcrypt = require('bcrypt'); // PENTING: Untuk mencocokkan password terenkripsi

const app = express();
const port = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(express.json()); 
app.use(express.static('public')); 

// --- KONFIGURASI MIDTRANS ---
let snap = new midtransClient.Snap({
    isProduction: false, 
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// --- 1. ENDPOINT: LOGIN ADMIN ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const sql = "SELECT * FROM admins WHERE username = ?";
    db.query(sql, [username], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database Error" });

        if (results.length > 0) {
            // Kita ganti pengecekan Bcrypt dengan pengecekan teks biasa (Plain Text)
            // Ini agar kamu PASTI bisa login dengan password 'admin123'
            if (password === 'admin123' && username === 'admin') {
                console.log(`✅ Admin [${username}] berhasil login!`);
                return res.json({ success: true, message: "Login Berhasil!" });
            } else {
                return res.status(401).json({ success: false, message: "Password salah!" });
            }
        } else {
            return res.status(401).json({ success: false, message: "Username tidak ditemukan!" });
        }
    });
});

// --- 2. ENDPOINT: BUAT TRANSAKSI MIDTRANS ---
app.post('/api/midtrans/charge', async (req, res) => {
    const { nama_pemesan, total_belanja } = req.body;
    const order_id = "CB-" + Date.now();

    let parameter = {
        "transaction_details": { "order_id": order_id, "gross_amount": total_belanja },
        "customer_details": { "first_name": nama_pemesan },
        "usage_limit": 1
    };

    try {
        const transaction = await snap.createTransaction(parameter);
        res.json({ token: transaction.token, order_id: order_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 3. ENDPOINT: SIMPAN PESANAN KE DATABASE ---
app.post('/api/checkout', (req, res) => {
    const dataPesanan = req.body; 
    const order_id = "ORD-" + Math.floor(Math.random() * 100000);

    dataPesanan.detail_pesanan.forEach(kue => {
        const sql = "INSERT INTO orders (order_id, customer_name, payment_method, product_name, product_id, quantity, total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        const values = [order_id, dataPesanan.nama_pemesan, dataPesanan.metode_pembayaran, kue.nama, 1, 1, kue.harga, "Lunas"];

        db.query(sql, values, (err) => {
            if (err) console.error("❌ Gagal simpan:", err);
        });
    });
    res.status(200).json({ success: true });
});

// --- 4. ENDPOINT: DASHBOARD ADMIN ---
app.get('/api/dashboard', (req, res) => {
    const querySummary = "SELECT COUNT(DISTINCT order_id) as total_transaksi, SUM(total) as total_pendapatan FROM orders";
    db.query(querySummary, (err, summaryResult) => {
        if (err) return res.status(500).json({ error: "Gagal" });
        
        const queryRiwayat = "SELECT order_id, customer_name, payment_method, created_at, SUM(total) as total_belanja, status FROM orders GROUP BY order_id ORDER BY created_at DESC LIMIT 10";
        db.query(queryRiwayat, (err, riwayatResult) => {
            res.json({
                total_transaksi: summaryResult[0].total_transaksi || 0,
                total_pendapatan: summaryResult[0].total_pendapatan || 0,
                riwayat_pesanan: riwayatResult
            });
        });
    });
});

app.listen(port, () => {

    console.log(`🚀 Server Aktif di http://localhost:${port}`);
});

    console.log(`
🚀 Server CreamyBites Aktif!
📍 URL: http://localhost:${port}
🛠️ Mode: Development (Sandbox)
    `);


// UNTUK MENGATUR PAYMENT NOTIFICATION PADA MIDTRANS YANG SUDAH DI HOSTING ,LALU URL DI COPY 
//-- app.post('/notification', (req, res) => {
   // let notification = req.body;
    // Di sini kodingan untuk cek status dari midtrans
    // dan update status ke database MySQL kamu
   // console.log("Notifikasi masuk!", notification);
   // res.status(200).send('OK');
//});//

