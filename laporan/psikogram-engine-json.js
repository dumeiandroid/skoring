/**
 * psikogram-engine.js
 * Berisi semua logika kalkulasi psikogram:
 * - Parser data dari API (x_02, x_05, x_06, x_10)
 * - Skoring CFIT → IQ
 * - Skoring EPPS → ws_ach, ws_dom, dll + konsistensi
 * - Skoring RMIB → out, mech, comp, dll
 * - Konversi skor ke skala 1-10
 * - Data statis: kekuatan_kelemahan, minat
 *
 * Cara pakai:
 *   Offline : <script src="psikogram-engine.js"></script>
 *   Online  : <script src="https://domain.com/js/psikogram-engine.js"></script>
 *
 * Setelah di-load, semua fungsi tersedia sebagai window.PsikogramEngine
 */

(function(global) {
    'use strict';

    // =========================================================
    // PARSER DATA
    // =========================================================

    function parseX02(x02) {
        // Format nilai1_json: {"nama":"...","usia":"...","jenis_kelamin":"...","pendidikan":"...","tgl_tes":"..."}
        // Dikembalikan sebagai array 2D agar sisa kode tetap kompatibel:
        // nama[0][0]=nama, nama[0][4]=usia, nama[0][8]=jenis_kelamin
        const obj = JSON.parse(x02 || '{}');
        const row = ['', '', '', '', '', '', '', '', ''];
        row[0] = obj.nama          || '';
        row[4] = obj.usia          || '';
        row[8] = obj.jenis_kelamin || '';
        return [row];
    }

    function parseX05(x05) {
        // Format nilai1_json: {"cfit1":12,"cfit2":8,"cfit3":15,"cfit4":9,"tkd3":30,"tkd6":18,...}
        // Mendukung key lama (tkd5, deret6) maupun key baru (tkd3, tkd6)
        // [0]=cfit1 [1]=cfit2 [2]=cfit3 [3]=cfit4 [15]=tkd3|tkd5 [17]=tkd6|deret6
        const obj = JSON.parse(x05 || '{}');
        const arr = new Array(20).fill('');
        arr[0]  = obj.cfit1  !== undefined ? String(obj.cfit1)  : '';
        arr[1]  = obj.cfit2  !== undefined ? String(obj.cfit2)  : '';
        arr[2]  = obj.cfit3  !== undefined ? String(obj.cfit3)  : '';
        arr[3]  = obj.cfit4  !== undefined ? String(obj.cfit4)  : '';
        arr[4]  = obj.ist1   !== undefined ? String(obj.ist1)   : '';
        arr[5]  = obj.ist2   !== undefined ? String(obj.ist2)   : '';
        arr[6]  = obj.ist3   !== undefined ? String(obj.ist3)   : '';
        arr[7]  = obj.ist4_a !== undefined ? String(obj.ist4_a) : '';
        arr[8]  = obj.ist5_a !== undefined ? String(obj.ist5_a) : '';
        arr[9]  = obj.ist6_a !== undefined ? String(obj.ist6_a) : '';
        arr[10] = obj.ist7   !== undefined ? String(obj.ist7)   : '';
        arr[11] = obj.ist8   !== undefined ? String(obj.ist8)   : '';
        arr[12] = obj.ist9   !== undefined ? String(obj.ist9)   : '';
        arr[13] = obj.apm1   !== undefined ? String(obj.apm1)   : '';
        arr[14] = obj.apm14  !== undefined ? String(obj.apm14)  : '';
        const tkd3val  = obj.tkd3  ?? obj.tkd5;   // tkd3 (baru) atau tkd5 (lama)
        const tkd6val  = obj.tkd6  ?? obj.deret6; // tkd6 (baru) atau deret6 (lama)
        arr[15] = tkd3val  !== undefined ? String(tkd3val)  : '';
        arr[17] = tkd6val  !== undefined ? String(tkd6val)  : '';
        return arr;
    }

    function parseX06(x06) {
        // Format nilai1_json: {"epps":"A;B;A;...","rmib_k1":"1;3;2;...","rmib_k2":"...",...}
        // Dikembalikan sebagai array index agar sisa kode kompatibel:
        // [0]=epps, [2]=rmib_k1 .. [9]=rmib_k8
        const obj = JSON.parse(x06 || '{}');
        const arr = new Array(12).fill('');
        arr[0] = obj.epps || '';
        for (let k = 1; k <= 8; k++) {
            arr[k + 1] = obj['rmib_k' + k] || '';
        }
        return arr;
    }

    function parseX10(x10) {
        // Setiap bagian dipisah | lalu masing-masing dipisah ;
        const parts = (x10 || '').split('|');
        return parts.map(p => p.split(';').map(s => s.trim()));
    }

    // =========================================================
    // SKORING CFIT → IQ
    // =========================================================

    function getIQ_cfit(skorTotal, usia) {
        const iqTable = {
            49:[183,183,183,183,183], 48:[183,183,183,179,179], 47:[183,183,179,176,176],
            46:[183,179,176,173,173], 45:[179,176,173,169,169], 44:[176,173,169,167,167],
            43:[175,171,168,165,165], 42:[171,168,165,161,161], 41:[167,163,160,157,157],
            40:[165,161,159,155,155], 39:[161,159,155,152,152], 38:[159,155,152,149,149],
            37:[155,152,149,145,145], 36:[152,149,145,142,142], 35:[150,147,144,140,140],
            34:[147,144,140,137,137], 33:[142,139,136,133,133], 32:[140,137,134,131,131],
            31:[137,134,131,128,128], 30:[134,131,128,126,124], 29:[131,128,124,123,121],
            28:[129,126,123,121,119], 27:[126,123,119,117,116], 26:[123,119,116,114,113],
            25:[119,116,113,111,109], 24:[116,113,109,108,106], 23:[113,109,106,104,103],
            22:[109,106,103,101,100], 21:[106,103,100,98,96],   20:[104,101,98,96,94],
            19:[101,98,94,93,91],     18:[98,94,91,89,88],      17:[94,91,88,86,85],
            16:[91,88,85,83,81],      15:[88,85,81,80,78],      14:[85,81,78,76,75],
            13:[81,78,75,73,72],      12:[80,76,73,72,70],      11:[76,73,70,68,67],
            10:[73,70,67,65,63],      9:[70,67,63,62,60],       8:[67,63,60,58,57],
            7:[63,60,57,56,55],       6:[60,57,55,53,52],       5:[57,55,53,51,48],
            4:[55,54,52,50,47],       3:[53,52,48,47,45],       2:[52,51,47,46,43],
            1:[50,50,46,45,40],       0:[48,48,45,43,38]
        };
        const u = parseFloat(usia) || 16;
        let ageIndex;
        if      (u >= 13.0 && u <= 13.4)  ageIndex = 0;
        else if (u >= 13.5 && u <= 13.11) ageIndex = 1;
        else if (u >= 14.0 && u <= 14.11) ageIndex = 2;
        else if (u >= 15.0 && u <= 15.11) ageIndex = 3;
        else if (u >= 16.0)               ageIndex = 4;
        else                               ageIndex = 4;

        const row = iqTable[Math.floor(skorTotal)];
        return row ? row[ageIndex] : 0;
    }

    // =========================================================
    // SKORING EPPS
    // =========================================================

    function skorEPPS(soalEpps) {
        // soalEpps: array 0-indexed, isi 'A' atau 'B'
        const s = soalEpps;
        const cntA = arr => arr.filter(v => v === 'A').length;
        const cntB = arr => arr.filter(v => v === 'B').length;

        // _r arrays (hitung A)
        const ach_r = [s[5],s[10],s[15],s[20],s[25],s[30],s[35],s[40],s[45],s[50],s[55],s[60],s[65],s[70]];
        const def_r = [s[1],s[11],s[16],s[21],s[26],s[31],s[36],s[41],s[46],s[51],s[56],s[61],s[66],s[71]];
        const ord_r = [s[2],s[7],s[17],s[22],s[27],s[32],s[37],s[42],s[47],s[52],s[57],s[62],s[67],s[72]];
        const exh_r = [s[3],s[8],s[13],s[23],s[28],s[33],s[38],s[43],s[48],s[53],s[58],s[63],s[68],s[73]];
        const aut_r = [s[4],s[9],s[14],s[19],s[29],s[34],s[39],s[44],s[49],s[54],s[59],s[64],s[69],s[74]];
        const aff_r = [s[75],s[80],s[85],s[90],s[95],s[105],s[110],s[115],s[120],s[125],s[130],s[135],s[140],s[145]];
        const int_r = [s[76],s[81],s[86],s[91],s[96],s[101],s[111],s[116],s[121],s[126],s[131],s[136],s[141],s[146]];
        const suc_r = [s[77],s[82],s[87],s[92],s[97],s[102],s[107],s[117],s[122],s[127],s[132],s[137],s[142],s[147]];
        const dom_r = [s[78],s[83],s[88],s[93],s[98],s[103],s[108],s[113],s[123],s[128],s[133],s[138],s[143],s[148]];
        const aba_r = [s[79],s[84],s[89],s[94],s[99],s[104],s[109],s[114],s[119],s[129],s[134],s[139],s[144],s[149]];
        const nur_r = [s[150],s[155],s[160],s[165],s[170],s[175],s[180],s[185],s[190],s[195],s[205],s[210],s[215],s[220]];
        const chg_r = [s[151],s[156],s[161],s[166],s[171],s[176],s[181],s[186],s[191],s[196],s[201],s[211],s[216],s[221]];
        const end_r = [s[152],s[157],s[162],s[167],s[172],s[177],s[182],s[187],s[192],s[197],s[202],s[207],s[217],s[222]];
        const het_r = [s[153],s[158],s[163],s[168],s[173],s[178],s[183],s[188],s[193],s[198],s[203],s[208],s[213],s[223]];
        const agg_r = [s[154],s[159],s[164],s[169],s[174],s[179],s[184],s[189],s[194],s[199],s[204],s[209],s[214],s[219]];

        // _c arrays (hitung B)
        const ach_c = [s[1],s[2],s[3],s[4],s[75],s[76],s[77],s[78],s[79],s[150],s[151],s[152],s[153],s[154]];
        const def_c = [s[5],s[7],s[8],s[9],s[80],s[81],s[82],s[83],s[84],s[155],s[156],s[157],s[158],s[159]];
        const ord_c = [s[10],s[11],s[13],s[14],s[85],s[86],s[87],s[88],s[89],s[160],s[161],s[162],s[163],s[164]];
        const exh_c = [s[15],s[16],s[17],s[19],s[90],s[91],s[92],s[93],s[94],s[165],s[166],s[167],s[168],s[169]];
        const aut_c = [s[20],s[21],s[22],s[23],s[95],s[96],s[97],s[98],s[99],s[170],s[171],s[172],s[173],s[174]];
        const aff_c = [s[25],s[26],s[27],s[28],s[29],s[101],s[102],s[103],s[104],s[175],s[176],s[177],s[178],s[179]];
        const int_c = [s[30],s[31],s[32],s[33],s[34],s[105],s[107],s[108],s[109],s[180],s[181],s[182],s[183],s[184]];
        const suc_c = [s[35],s[36],s[37],s[38],s[39],s[110],s[111],s[113],s[114],s[185],s[186],s[187],s[188],s[189]];
        const dom_c = [s[40],s[41],s[42],s[43],s[44],s[115],s[116],s[117],s[119],s[190],s[191],s[192],s[193],s[194]];
        const aba_c = [s[45],s[46],s[47],s[48],s[49],s[120],s[121],s[122],s[123],s[195],s[196],s[197],s[198],s[199]];
        const nur_c = [s[50],s[51],s[52],s[53],s[54],s[125],s[126],s[127],s[128],s[129],s[201],s[202],s[203],s[204]];
        const chg_c = [s[55],s[56],s[57],s[58],s[59],s[130],s[131],s[132],s[133],s[134],s[205],s[207],s[208],s[209]];
        const end_c = [s[60],s[61],s[62],s[63],s[64],s[135],s[136],s[137],s[138],s[139],s[210],s[211],s[213],s[214]];
        const het_c = [s[65],s[66],s[67],s[68],s[69],s[140],s[141],s[142],s[143],s[144],s[215],s[216],s[217],s[219]];
        const agg_c = [s[70],s[71],s[72],s[73],s[74],s[145],s[146],s[147],s[148],s[149],s[220],s[221],s[222],s[223]];

        const ach_s = cntA(ach_r) + cntB(ach_c);
        const def_s = cntA(def_r) + cntB(def_c);
        const ord_s = cntA(ord_r) + cntB(ord_c);
        const exh_s = cntA(exh_r) + cntB(exh_c);
        const out_s = cntA(aut_r) + cntB(aut_c);
        const aff_s = cntA(aff_r) + cntB(aff_c);
        const int_s = cntA(int_r) + cntB(int_c);
        const suc_s = cntA(suc_r) + cntB(suc_c);
        const dom_s = cntA(dom_r) + cntB(dom_c);
        const aba_s = cntA(aba_r) + cntB(aba_c);
        const nur_s = cntA(nur_r) + cntB(nur_c);
        const chg_s = cntA(chg_r) + cntB(chg_c);
        const end_s = cntA(end_r) + cntB(end_c);
        const het_s = cntA(het_r) + cntB(het_c);
        const agg_s = cntA(agg_r) + cntB(agg_c);

        // Konsistensi (15 pasang soal yang diulang)
        const kPairs = [
            [0,150],[6,156],[12,162],[18,168],[24,174],
            [25,100],[31,106],[37,112],[43,118],[49,124],
            [50,200],[56,206],[62,212],[68,218],[74,224]
        ];
        let konsistensi = 0;
        kPairs.forEach(([a,b]) => {
            if (s[a] && s[b] && s[a] === s[b]) konsistensi++;
        });

        // Tabel WS mapping
        const wsMap = {
            ACH_s:{28:20,27:20,26:19,25:18,24:17,23:16,22:16,21:15,20:14,19:13,18:12,17:11,16:10,15:9,14:8,13:7,12:6,11:5,10:5,9:4,8:3,7:2,6:1,5:0,4:0,3:0,2:0,1:0,0:0},
            DEF_s:{22:20,21:19,20:18,19:18,18:18,17:17,16:16,15:15,14:14,13:13,12:11,11:11,10:10,9:9,8:8,7:7,6:6,5:5,4:3,3:3,2:2,1:1,0:0},
            ORD_s:{28:20,27:19,26:19,25:18,24:17,23:17,22:16,21:15,20:15,19:14,18:13,17:13,16:12,15:11,14:10,13:9,12:9,11:8,10:7,9:7,8:6,7:5,6:5,5:4,4:3,3:3,2:2,1:1,0:1},
            EXH_s:{24:20,23:19,22:18,21:18,20:17,19:16,18:15,17:15,16:14,15:13,14:12,13:11,12:10,11:9,10:8,9:7,8:7,7:6,6:5,5:4,4:3,3:3,2:2,1:1,0:0},
            OUT_s:{21:20,20:19,19:18,18:17,17:16,16:15,15:14,14:13,13:12,12:11,11:10,10:9,9:8,8:7,7:6,6:5,5:4,4:3,3:2,2:2,1:1,0:0},
            AFF_s:{26:20,25:19,24:19,23:18,22:17,21:16,20:15,19:14,18:14,17:13,16:12,15:11,14:10,13:9,12:8,11:8,10:7,9:6,8:5,7:4,6:3,5:3,4:2,3:1,2:1,1:0},
            INT_s:{28:20,27:20,26:19,25:18,24:17,23:17,22:16,21:15,20:14,19:14,18:13,17:12,16:11,15:10,14:9,13:8,12:7,11:7,10:6,9:5,8:4,7:4,6:3,5:2,4:1,3:1,2:0,1:0},
            SUC_s:{27:20,26:19,25:19,24:18,23:17,22:17,21:16,20:15,19:15,18:14,17:13,16:13,15:12,14:11,13:10,12:9,11:9,10:8,9:7,8:7,7:6,6:5,5:4,4:4,3:3,2:2,1:1,0:1},
            DOM_s:{25:20,24:20,23:19,22:18,21:17,20:17,19:16,18:15,17:14,16:14,15:13,14:12,13:11,12:10,11:9,10:8,9:8,8:7,7:6,6:5,5:5,4:4,3:3,2:2,1:1,0:0},
            ABA_s:{29:20,28:19,27:18,26:18,25:17,24:16,23:15,22:15,21:14,20:13,19:13,18:12,17:11,16:10,15:9,14:8,13:8,12:7,11:6,10:5,9:5,8:4,7:3,6:2,5:2,4:1,3:0,2:0,1:0},
            NUR_s:{30:20,29:19,28:18,27:18,26:17,25:16,24:16,23:15,22:14,21:14,20:13,19:12,18:12,17:11,16:10,15:9,14:9,13:8,12:7,11:7,10:6,9:5,8:5,7:4,6:3,5:3,4:2,3:1,2:1,1:0},
            CHG_s:{27:20,26:19,25:18,24:18,23:17,22:16,21:16,20:15,19:14,18:13,17:13,16:12,15:11,14:10,13:9,12:9,11:8,10:7,9:6,8:6,7:5,6:4,5:3,4:3,3:2,2:1,1:1,0:0},
            END_s:{30:20,29:19,28:18,27:17,26:17,25:16,24:16,23:15,22:14,21:14,20:13,19:13,18:12,17:12,16:11,15:10,14:9,13:9,12:8,11:7,10:7,9:6,8:6,7:5,6:4,5:4,4:3,3:3,2:2,1:1,0:1},
            HET_s:{26:20,25:19,24:19,23:18,22:18,21:17,20:17,19:16,18:16,17:15,16:15,15:14,14:14,13:13,12:12,11:12,10:11,9:11,8:10,7:9,6:9,5:8,4:8,3:7,2:7,1:6,0:5},
            AGG_s:{27:20,26:19,25:18,24:18,23:17,22:16,21:16,20:15,19:14,18:14,17:13,16:12,15:12,14:11,13:10,12:9,11:9,10:8,9:7,8:7,7:6,6:5,5:5,4:4,3:3,2:3,1:2,0:1}
        };

        function getWS(ss, type) {
            const m = wsMap[type];
            if (!m) return 0;
            const keys = Object.keys(m).map(Number).sort((a,b) => b - a);
            for (const k of keys) {
                if (ss >= k) return m[k];
            }
            return 0;
        }

        return {
            ws_ach: getWS(ach_s, 'ACH_s'),
            ws_def: getWS(def_s, 'DEF_s'),
            ws_ord: getWS(ord_s, 'ORD_s'),
            ws_exh: getWS(exh_s, 'EXH_s'),
            ws_out: getWS(out_s, 'OUT_s'),
            ws_aff: getWS(aff_s, 'AFF_s'),
            ws_int: getWS(int_s, 'INT_s'),
            ws_suc: getWS(suc_s, 'SUC_s'),
            ws_dom: getWS(dom_s, 'DOM_s'),
            ws_aba: getWS(aba_s, 'ABA_s'),
            ws_nur: getWS(nur_s, 'NUR_s'),
            ws_chg: getWS(chg_s, 'CHG_s'),
            ws_end: getWS(end_s, 'END_s'),
            ws_het: getWS(het_s, 'HET_s'),
            ws_agg: getWS(agg_s, 'AGG_s'),
            konsistensi
        };
    }

    // =========================================================
    // SKORING RMIB
    // =========================================================
    // Logika baru (sesuai rmib.html):
    //   - Setiap rmib_k1..k8 adalah satu kolom (A..H)
    //   - Angka pertama tiap kolom → sel X (baris = index kolom, 0-based)
    //   - Sisa angka → isi baris lain berurutan, wrap, lewati baris X
    //   - Total per baris = jumlah SEMUA nilai di baris (termasuk sel X)
    //   - Rank 1 = total terkecil
    //
    // Urutan baris (rowDefs):
    //   0=out, 1=mech, 2=comp, 3=acie, 4=pers, 5=aesth, 6=mus, 7=lite,
    //   8=sos_wer, 9=cler, 10=prac, 11=med

    function buildRmibKolData(rawKols) {
        // rawKols: array of 8 arrays of numbers
        // Returns kolData[col][row] for 8 cols x 12 rows
        const kolData = Array.from({ length: 8 }, () => new Array(12).fill(0));
        for (let col = 0; col < 8; col++) {
            const vals = rawKols[col] || [];
            if (vals.length === 0) continue;
            const xRow = col; // baris X = index kolom (0–7)
            // Angka pertama → sel X
            kolData[col][xRow] = vals[0];
            // Sisa → baris lain, wrap, lewati xRow
            let cursor = (xRow + 1) % 12;
            for (let i = 1; i < vals.length; i++) {
                if (cursor === xRow) cursor = (cursor + 1) % 12;
                kolData[col][cursor] = vals[i];
                cursor = (cursor + 1) % 12;
            }
        }
        return kolData;
    }

    function hitungTotalRmib(kolData) {
        // Jumlah per baris (semua 8 kolom, termasuk sel X)
        const totals = new Array(12).fill(0);
        for (let row = 0; row < 12; row++) {
            for (let col = 0; col < 8; col++) {
                totals[row] += kolData[col][row] || 0;
            }
        }
        // Kembalikan sebagai objek dengan nama minat sesuai urutan rowDefs
        return {
            out:     totals[0],
            mech:    totals[1],
            comp:    totals[2],
            acie:    totals[3],
            pers:    totals[4],
            aesth:   totals[5],
            mus:     totals[6],
            lite:    totals[7],
            sos_wer: totals[8],
            cler:    totals[9],
            prac:    totals[10],
            med:     totals[11]
        };
    }

    function skorRMIB(rawKols) {
        const kolData = buildRmibKolData(rawKols);
        return hitungTotalRmib(kolData);
    }

    // =========================================================
    // KONVERSI SKOR KE SKALA 1–10
    // =========================================================

    function getScore(value, type) {
        const criteria = {
            iq:   [[60,1],[69,2],[79,3],[89,4],[99,5],[109,6],[119,7],[129,8],[139,9],[Infinity,10]],
            cfit: [[2,1],[3,2],[4,3],[5,4],[7,5],[8,6],[9,7],[10,8],[11,9],[Infinity,10]],
            tkd3: [[12,1],[16,2],[20,3],[23,4],[27,5],[31,6],[35,7],[38,8],[40,9],[Infinity,10]],
            tkd6: [[2,1],[5,2],[9,3],[12,4],[16,5],[19,6],[23,7],[26,8],[30,9],[Infinity,10]],
            ach:  [[2,1],[4,2],[6,3],[8,4],[10,5],[12,6],[14,7],[16,8],[18,9],[Infinity,10]]
        };
        const crit = criteria[type] || criteria.ach;
        for (const [limit, score] of crit) {
            if (value <= limit) return score;
        }
        return 10;
    }

    // =========================================================
    // FUNGSI UTAMA: hitung semua skor dari raw data API
    // =========================================================

    function hitungPsikogram(data, id_x) {
        // Buat seeded random berdasarkan id kandidat
        // Setiap kandidat mendapat versi kalimat yang konsisten (tidak berubah saat refresh)
        const rand = makeSeededRand(seedFromId(id_x));

        const x02 = data['x_02'] || '';
        const x05 = data['x_05'] || '';
        const x06 = data['x_06'] || '';
        const x10 = data['x_10'] || '';

        const nama    = parseX02(x02);
        const nilai05 = parseX05(x05);
        const x6arr   = parseX06(x06);
        const hasil10 = parseX10(x10);

        const usia = parseFloat(nama[0] ? nama[0][4] : 16) || 16;

        // CFIT
        const CFIT1 = parseInt(nilai05[0]) || 0;
        const CFIT2 = parseInt(nilai05[1]) || 0;
        const CFIT3 = parseInt(nilai05[2]) || 0;
        const CFIT4 = parseInt(nilai05[3]) || 0;
        const skorCFIT = CFIT1 + CFIT2 + CFIT3 + CFIT4;
        const iqCalc = getIQ_cfit(skorCFIT, usia);

        // Gunakan override dari hasil10[0][3] jika ada
        const IQ = (hasil10[0] && hasil10[0][3] && parseInt(hasil10[0][3]) !== 0)
            ? parseInt(hasil10[0][3]) : iqCalc;

        const tkd3 = parseFloat(nilai05[15]) || 0;
        const tkd6 = parseFloat(nilai05[17]) || 0;

        // EPPS
        const soalEppsStr = x6arr[0] || '';
        const soalEpps = soalEppsStr.split(';').map(v => v.trim());
        const epps = skorEPPS(soalEpps);

        const ACH = epps.ws_ach;
        const DOM = epps.ws_dom;
        const AUT = epps.ws_out;
        const EXH = epps.ws_exh;
        const AFF = epps.ws_aff;
        const DEF = epps.ws_def;
        const ORD = epps.ws_ord;

        // RMIB — parse tiap kolom k1..k8 secara terpisah (sesuai rmib.html)
        const rawKolsRmib = [];
        for (let k = 2; k <= 9; k++) {  // x6arr[2]=k1 .. x6arr[9]=k8
            rawKolsRmib.push(
                (x6arr[k] || '').split(';').map(s => s.trim()).filter(s => s !== '').map(Number)
            );
        }
        const rmib = skorRMIB(rawKolsRmib);

        // Skor skala 1–10 (14 aspek psikologis)
        let resultScores = [
            getScore(IQ, 'iq'),                        // 0: Kemampuan Umum
            getScore(CFIT2, 'cfit'),                   // 1: Daya Tangkap Visual
            getScore((CFIT1 + CFIT4) / 2, 'cfit'),    // 2: Berpikir Logis
            getScore(CFIT3, 'cfit'),                   // 3: Berpikir Abstrak
            getScore(tkd3, 'tkd3'),                    // 4: Penalaran Verbal
            getScore(tkd6, 'tkd6'),                    // 5: Penalaran Numerik
            getScore(ACH, 'ach'),                      // 6: Hasrat Berprestasi
            getScore((DOM + ACH + AUT) / 3, 'ach'),   // 7: Daya Tahan Stress
            getScore(EXH, 'ach'),                      // 8: Kepercayaan Diri
            getScore(AFF, 'ach'),                      // 9: Relasi Sosial
            getScore(DEF, 'ach'),                      // 10: Kerjasama
            getScore(ORD, 'ach'),                      // 11: Sistematika Kerja
            getScore((DOM + ACH + AUT) / 3, 'ach'),   // 12: Inisiatif
            getScore(AUT, 'ach')                       // 13: Kemandirian
        ];

        // Override dengan hasil10[1] jika ada nilai tidak kosong/0
        for (let i = 0; i <= 13; i++) {
            if (hasil10[1] && hasil10[1][i] && parseInt(hasil10[1][i]) !== 0) {
                resultScores[i] = parseInt(hasil10[1][i]);
            }
        }

        // Minat RMIB: urutkan dari terkecil (3 arah minat utama)
        const totalsRmib = {
            'OUT': rmib.out, 'MECH': rmib.mech, 'COMP': rmib.comp,
            'ACIE': rmib.acie, 'PERS': rmib.pers, 'AESTH': rmib.aesth,
            'LITE': rmib.lite, 'MUS': rmib.mus, 'SOS. WERV': rmib.sos_wer,
            'CLER': rmib.cler, 'PRAC': rmib.prac, 'MED': rmib.med
        };
        const sortedMinat = Object.entries(totalsRmib).sort((a, b) => a[1] - b[1]);
        const minat3 = sortedMinat.slice(0, 3).map(([key], j) => ({
            singkatan: key,
            namaOverride: hasil10[5] && hasil10[5][j] && hasil10[5][j].trim() !== '' ? hasil10[5][j].trim() : null,
            ketOverride:  hasil10[6] && hasil10[6][j] && hasil10[6][j].trim() !== '' ? hasil10[6][j].trim() : null
        }));

        // Mapping index aspek ke grup
        // 0-5 = KEMAMPUAN, 6-10 = KEPRIBADIAN, 11-13 = SIKAP KERJA
        const grupAspek = [0,0,0,0,0,0, 1,1,1,1,1, 2,2,2];

        // Kelebihan / Kelemahan / Rekomendasi berdasarkan skor tertinggi & terendah
        const indexed = resultScores.map((v, i) => ({ value: v, index: i }));
        const sorted_desc = [...indexed].sort((a, b) => b.value - a.value);
        const sorted_asc  = [...indexed].sort((a, b) => a.value - b.value);

        /**
         * Pilih 3 kandidat dari daftar terurut dengan aturan:
         * - Utamakan 1 dari masing-masing grup yang berbeda (selama masih ada)
         * - Urutan tetap mengikuti skor (bukan urutan grup)
         * - Baru ambil lebih dari 1 dari grup yang sama jika grup lain sudah habis
         */
        function pilih3Distribusi(sortedList) {
            const hasil = [];
            const grupTerpakai = new Set();

            // Pass 1: ambil satu per grup (prioritas grup berbeda, tetap urut skor)
            for (const item of sortedList) {
                if (hasil.length >= 3) break;
                const grup = grupAspek[item.index];
                if (!grupTerpakai.has(grup)) {
                    hasil.push(item);
                    grupTerpakai.add(grup);
                }
            }

            // Pass 2: jika belum 3 (berarti ada grup yang kosong), ambil sisa urut skor
            if (hasil.length < 3) {
                const sudahDiambil = new Set(hasil.map(h => h.index));
                for (const item of sortedList) {
                    if (hasil.length >= 3) break;
                    if (!sudahDiambil.has(item.index)) {
                        hasil.push(item);
                        sudahDiambil.add(item.index);
                    }
                }
            }

            return hasil;
        }

        const top3    = pilih3Distribusi(sorted_desc); // untuk kelebihan
        const bottom3 = pilih3Distribusi(sorted_asc);  // untuk kelemahan & rekomendasi

        // Override manual dari hasil10 jika ada, fallback ke teks engine
        const getKelebihan = i => hasil10[2] && hasil10[2][i] && hasil10[2][i].trim() !== ''
            ? hasil10[2][i].trim() : pilihVersi(kekuatanKelemahan[top3[i].index].teks2, rand);
        const getKelemahan = i => hasil10[3] && hasil10[3][i] && hasil10[3][i].trim() !== ''
            ? hasil10[3][i].trim() : pilihVersi(kekuatanKelemahan[bottom3[i].index].teks3, rand);
        const getReko = i => hasil10[4] && hasil10[4][i] && hasil10[4][i].trim() !== ''
            ? hasil10[4][i].trim() : pilihVersi(kekuatanKelemahan[bottom3[i].index].teks5, rand);

        return {
            // Identitas
            identitas: {
                nama:    nama[0] ? nama[0][0]  : '',
                jk:      nama[0] ? nama[0][8]  : '',
                usia:    nama[0] ? nama[0][4]  : '',
                tanggal: hasil10[0] ? hasil10[0][1] : '',
                tanggalTTD: hasil10[0] ? hasil10[0][4] : ''
            },
            // Skor
            IQ,
            resultScores,
            konsistensi: epps.konsistensi,
            // Indeks terurut (tetap dikirim untuk keperluan render tabel)
            sorted_desc,
            sorted_asc,
            // Teks hasil distribusi lintas grup
            kelebihan:  [getKelebihan(0), getKelebihan(1), getKelebihan(2)],
            kelemahan:  [getKelemahan(0), getKelemahan(1), getKelemahan(2)],
            rekomendasi:[getReko(0),      getReko(1),      getReko(2)],
            minat3
        };
    }

    // =========================================================
    // SEEDED RANDOM — hasil konsisten per kandidat (id_x)
    // =========================================================

    /**
     * Simple seeded PRNG (mulberry32).
     * Mengembalikan fungsi rand() yang menghasilkan float [0,1).
     */
    function makeSeededRand(seed) {
        let s = seed >>> 0;
        return function() {
            s += 0x6D2B79F5;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /**
     * Ubah string id_x menjadi angka seed integer.
     */
    function seedFromId(id_x) {
        let h = 0;
        const str = String(id_x || '0');
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return h >>> 0;
    }

    /**
     * Pilih satu elemen dari array berdasarkan rand().
     * Jika bukan array, kembalikan nilai aslinya (backward-compat).
     */
    function pilihVersi(arr, rand) {
        if (!Array.isArray(arr)) return arr;
        return arr[Math.floor(rand() * arr.length)];
    }

    // =========================================================
    // DATA STATIS — 5 versi per teks2 (kelebihan), teks3 (kelemahan), teks5 (rekomendasi)
    // =========================================================

    const kekuatanKelemahan = [
        {
            teks1: "Kemampuan Umum",
            teks2: [
                "Mampu menemukan solusi untuk berbagai masalah dengan efektif.",
                "Memiliki kemampuan analitis yang baik dalam mengurai dan menyelesaikan persoalan.",
                "Cakap dalam memahami situasi dan merancang langkah penyelesaian yang tepat.",
                "Menunjukkan ketajaman berpikir yang membantu dalam menghadapi berbagai tantangan.",
                "Dikenal mampu berpikir sistematis sehingga permasalahan dapat diselesaikan dengan baik."
            ],
            teks3: [
                "Kesulitan menghadapi masalah yang sangat kompleks.",
                "Cenderung kewalahan ketika dihadapkan pada persoalan berlapis yang memerlukan analisis mendalam.",
                "Terkadang membutuhkan waktu lebih lama untuk memproses masalah yang memiliki banyak variabel.",
                "Kurang optimal dalam mengelola masalah yang menuntut pendekatan multidimensi secara bersamaan.",
                "Perlu pengembangan lebih lanjut dalam menangani permasalahan yang tidak memiliki solusi tunggal."
            ],
            teks5: [
                "Disarankan untuk melatih kemampuan pemecahan masalah dengan mengikuti simulasi kasus kompleks dan berpartisipasi dalam diskusi kelompok, sehingga dapat meningkatkan ketahanan dalam menghadapi tantangan yang lebih besar.",
                "Sangat dianjurkan untuk aktif mengikuti pelatihan studi kasus dan forum diskusi lintas bidang, agar wawasan dalam memecahkan masalah kompleks semakin berkembang.",
                "Sebaiknya membiasakan diri membaca kasus nyata dari berbagai bidang dan menganalisisnya secara mandiri, guna melatih fleksibilitas berpikir ketika menghadapi situasi yang lebih rumit.",
                "Direkomendasikan untuk mencari mentor yang berpengalaman dan secara rutin mendiskusikan tantangan pekerjaan, sehingga kemampuan memecahkan masalah kompleks dapat terasah secara bertahap.",
                "Penting untuk berlatih menggunakan kerangka berpikir terstruktur seperti root-cause analysis dalam pekerjaan sehari-hari, agar kemampuan menangani masalah berlapis semakin terasah."
            ]
        },
        {
            teks1: "Daya Tangkap Visual",
            teks2: [
                "Cepat mengenali pola dan perbedaan di lingkungan sekitar.",
                "Memiliki kepekaan tinggi dalam membaca informasi visual secara cepat dan akurat.",
                "Tanggap terhadap perubahan visual sehingga mampu merespons situasi dengan sigap.",
                "Mampu mengidentifikasi detail visual dengan baik dalam situasi yang berubah-ubah.",
                "Unggul dalam memproses informasi yang bersifat visual dan spasial."
            ],
            teks3: [
                "Kurang perhatian terhadap detail yang lebih kecil, yang mempengaruhi hasil akhir.",
                "Terkadang melewatkan informasi visual yang bersifat minor namun berdampak pada kualitas pekerjaan.",
                "Cenderung terfokus pada gambaran besar sehingga detail-detail kecil sering luput dari perhatian.",
                "Perlu peningkatan dalam memperhatikan elemen-elemen kecil yang turut menentukan ketepatan hasil kerja.",
                "Kadang kurang cermat dalam memeriksa kembali detail visual, sehingga berpotensi menimbulkan kesalahan kecil."
            ],
            teks5: [
                "Sangat dianjurkan untuk mempraktikkan teknik mindfulness yang dapat membantu meningkatkan fokus terhadap detail kecil, sehingga hasil kerja dapat lebih maksimal dan akurat.",
                "Direkomendasikan untuk membiasakan diri melakukan pengecekan ulang secara terstruktur pada setiap hasil pekerjaan, agar detail-detail penting tidak terlewatkan.",
                "Sebaiknya berlatih menggunakan checklist dalam setiap tahapan pekerjaan, sehingga perhatian terhadap detail kecil dapat terjaga secara konsisten.",
                "Disarankan untuk melatih konsentrasi dengan latihan visual seperti puzzle atau aktivitas yang memerlukan ketelitian tinggi, agar sensitivitas terhadap detail semakin meningkat.",
                "Penting untuk mengalokasikan waktu khusus untuk review hasil pekerjaan sebelum diselesaikan, guna memastikan tidak ada detail penting yang terlewat."
            ]
        },
        {
            teks1: "Kemampuan Berpikir Logis",
            teks2: [
                "Mampu membuat keputusan berdasarkan alasan yang jelas dalam situasi tertentu.",
                "Menunjukkan kemampuan yang baik dalam menyusun argumen yang runtut dan terstruktur.",
                "Cenderung mengambil keputusan secara objektif berdasarkan fakta dan data yang tersedia.",
                "Terbiasa berpikir secara sistematis sehingga mampu menilai situasi dengan pertimbangan yang matang.",
                "Dikenal memiliki pendekatan yang rasional dalam menghadapi berbagai permasalahan."
            ],
            teks3: [
                "Kesulitan membuat keputusan cepat dalam situasi mendesak.",
                "Cenderung membutuhkan waktu lebih lama untuk mengambil keputusan ketika tekanan waktu meningkat.",
                "Kurang optimal dalam situasi yang menuntut respons cepat tanpa kesempatan analisis mendalam.",
                "Terkadang terlalu berhati-hati dalam mengambil keputusan sehingga terhambat ketika waktu sangat terbatas.",
                "Perlu peningkatan dalam membuat keputusan yang cepat namun tetap tepat sasaran di bawah tekanan."
            ],
            teks5: [
                "Sebaiknya mengikuti pelatihan khusus yang dirancang untuk pengambilan keputusan di bawah tekanan, agar dapat meningkatkan kecepatan dan ketepatan dalam mengambil keputusan ketika situasi mendesak.",
                "Disarankan untuk berlatih skenario pengambilan keputusan cepat melalui simulasi atau permainan strategi, sehingga respons dalam kondisi tekanan dapat semakin terasah.",
                "Sangat dianjurkan untuk mempelajari teknik keputusan berbasis prioritas seperti metode Eisenhower Matrix, agar dalam situasi mendesak tetap dapat memilih tindakan yang paling tepat.",
                "Penting untuk membangun kebiasaan membuat kerangka keputusan sederhana yang bisa digunakan secara cepat, sehingga proses berpikir tidak terhambat ketika waktu sangat terbatas.",
                "Direkomendasikan untuk secara rutin berlatih dalam situasi yang mensimulasikan tekanan waktu, agar rasa percaya diri dan kecepatan dalam memutuskan dapat terus berkembang."
            ]
        },
        {
            teks1: "Kemampuan Berpikir Abstrak",
            teks2: [
                "Mampu melihat hubungan antara berbagai hal dan memahami konsekuensi dari tindakan.",
                "Unggul dalam memahami konsep-konsep yang bersifat non-literal dan penuh makna tersirat.",
                "Memiliki kemampuan yang baik dalam mengaitkan ide-ide dari berbagai perspektif secara kreatif.",
                "Cakap dalam memahami pola tersembunyi dan implikasi jangka panjang dari sebuah situasi.",
                "Mampu berpikir di luar kerangka konvensional sehingga menghasilkan sudut pandang yang segar."
            ],
            teks3: [
                "Tantangan dalam menerjemahkan ide-ide abstrak ke dalam praktik.",
                "Terkadang mengalami kesulitan dalam mengubah konsep besar menjadi langkah-langkah kerja yang konkret.",
                "Ide-ide yang dihasilkan cenderung masih bersifat umum dan membutuhkan penjabaran lebih lanjut.",
                "Perlu peningkatan dalam menghubungkan konsep abstrak dengan kebutuhan dan konteks nyata di lapangan.",
                "Kadang terlalu asyik dengan ide tanpa cukup memikirkan bagaimana mewujudkannya secara praktis."
            ],
            teks5: [
                "Disarankan untuk melakukan proyek kecil yang akan membantu menerapkan ide-ide abstrak ke dalam praktik nyata, sehingga dapat belajar dari pengalaman dan meningkatkan kemampuan penerapan ide.",
                "Sangat bermanfaat untuk membiasakan diri membuat rencana aksi dari setiap ide yang muncul, agar gagasan tidak hanya berhenti pada tataran konsep.",
                "Direkomendasikan untuk berkolaborasi dengan rekan yang memiliki kekuatan eksekusi, sehingga ide-ide abstrak dapat lebih mudah diwujudkan menjadi hasil yang nyata.",
                "Sebaiknya belajar menggunakan alat bantu seperti mind-mapping atau canvas model untuk menstrukturkan ide ke dalam bentuk yang lebih operasional.",
                "Penting untuk melatih diri membuat prototipe atau uji coba kecil dari setiap ide, agar kemampuan mengeksekusi konsep abstrak secara bertahap semakin meningkat."
            ]
        },
        {
            teks1: "Penalaran Verbal",
            teks2: [
                "Mampu berkomunikasi dengan jelas dan efektif dalam interaksi.",
                "Memiliki kemampuan berbahasa yang baik sehingga pesan dapat tersampaikan dengan tepat.",
                "Terampil dalam menyusun kalimat yang lugas dan mudah dipahami oleh lawan bicara.",
                "Dikenal komunikatif dan mampu menyesuaikan gaya bicara dengan berbagai situasi.",
                "Cakap dalam mengungkapkan gagasan secara verbal baik secara lisan maupun tulisan."
            ],
            teks3: [
                "Kurang sabar dalam mendengarkan pandangan orang lain, yang menghambat komunikasi.",
                "Terkadang lebih fokus pada penyampaian pendapat sendiri daripada menyimak masukan dari orang lain.",
                "Cenderung kurang memberikan ruang bagi lawan bicara untuk mengekspresikan pandangannya secara penuh.",
                "Perlu peningkatan dalam keterampilan mendengar aktif agar komunikasi dua arah lebih seimbang.",
                "Kadang terburu-buru merespons sehingga tidak sepenuhnya memahami maksud yang ingin disampaikan orang lain."
            ],
            teks5: [
                "Sangat bermanfaat untuk melatih keterampilan mendengarkan aktif melalui kegiatan role-playing, yang dapat meningkatkan kemampuan untuk menghargai pandangan orang lain dan memperbaiki komunikasi.",
                "Disarankan untuk berlatih teknik parafrase dalam setiap percakapan, yaitu mengulang kembali apa yang disampaikan lawan bicara sebelum merespons, agar komunikasi menjadi lebih efektif.",
                "Penting untuk membiasakan diri menahan respons sejenak dan memastikan pemahaman yang tepat sebelum menjawab, guna menciptakan komunikasi yang lebih saling menghargai.",
                "Direkomendasikan untuk mengikuti pelatihan komunikasi atau bergabung dalam forum diskusi terstruktur, sehingga kemampuan mendengarkan dan merespons secara seimbang dapat terus berkembang.",
                "Sebaiknya melatih kesadaran diri dalam percakapan dengan secara sengaja memberikan giliran bicara yang lebih banyak kepada orang lain, agar dinamika komunikasi menjadi lebih harmonis."
            ]
        },
        {
            teks1: "Penalaran Numerik",
            teks2: [
                "Kemampuan memahami proses hitung dan berpikir teratur.",
                "Mampu mengolah data angka dengan teliti dan sistematis.",
                "Memiliki kebiasaan berpikir terstruktur yang mendukung pemahaman terhadap konsep kuantitatif.",
                "Cakap dalam menggunakan logika numerik untuk mendukung analisis dan pengambilan keputusan.",
                "Terbiasa bekerja dengan data yang memerlukan ketelitian perhitungan dan ketepatan angka."
            ],
            teks3: [
                "Memerlukan waktu lebih lama untuk memahami konsep matematika yang lebih rumit.",
                "Terkadang mengalami hambatan ketika berhadapan dengan kalkulasi yang melibatkan banyak langkah sekaligus.",
                "Kurang lancar dalam menyederhanakan operasi matematika yang kompleks menjadi langkah-langkah yang lebih mudah.",
                "Perlu peningkatan dalam kecepatan dan ketepatan saat menangani soal numerik dengan tingkat kerumitan tinggi.",
                "Kadang merasa kurang percaya diri dalam mengerjakan soal-soal yang memadukan beberapa konsep matematis sekaligus."
            ],
            teks5: [
                "Disarankan untuk berlatih secara rutin dengan soal-soal matematika yang lebih kompleks, agar dapat meningkatkan kecepatan dan pemahaman dalam konsep yang rumit.",
                "Sangat dianjurkan untuk memanfaatkan aplikasi atau platform latihan numerik setiap hari, sehingga kemampuan berhitung semakin terasah secara konsisten.",
                "Sebaiknya memulai dari pemahaman konsep dasar yang kuat sebelum beralih ke topik yang lebih kompleks, agar fondasi berpikir numerik semakin kokoh.",
                "Direkomendasikan untuk bergabung dalam kelompok belajar yang fokus pada matematika terapan, agar dapat saling bertukar strategi penyelesaian soal yang efektif.",
                "Penting untuk membiasakan diri mengerjakan soal-soal bertingkat secara berkala, dimulai dari yang sederhana hingga yang paling kompleks, guna membangun kepercayaan diri secara bertahap."
            ]
        },
        {
            teks1: "Hasrat Berprestasi",
            teks2: [
                "Keinginan untuk mencapai dan meningkatkan prestasi.",
                "Memiliki motivasi yang kuat untuk terus berkembang dan mencapai hasil terbaik.",
                "Dikenal sebagai pribadi yang tidak mudah puas dan selalu berupaya meningkatkan standar kerjanya.",
                "Menunjukkan semangat tinggi dalam mengejar target dan memberikan hasil yang melampaui ekspektasi.",
                "Terdorong oleh ambisi positif untuk memberikan kontribusi nyata dalam setiap pekerjaan yang dijalani."
            ],
            teks3: [
                "Beban ekspektasi tinggi dapat memengaruhi fokus dan kinerja.",
                "Terkadang tekanan untuk selalu tampil sempurna justru menimbulkan kecemasan yang mengganggu produktivitas.",
                "Ekspektasi yang terlalu besar terhadap diri sendiri dapat menjadi bumerang dan memperlambat progres.",
                "Cenderung sulit menerima hasil yang dianggap kurang sempurna, sehingga menghambat kemampuan untuk bergerak maju.",
                "Perlu belajar menyeimbangkan ambisi dengan penerimaan terhadap proses, agar kinerja tidak terbebani secara berlebihan."
            ],
            teks5: [
                "Sangat penting untuk menetapkan tujuan yang realistis dan melakukan evaluasi berkala, agar dapat menjaga motivasi dan fokus pada pencapaian yang lebih terukur.",
                "Disarankan untuk menerapkan pendekatan growth mindset, yaitu memandang setiap kesalahan sebagai bagian dari proses belajar, sehingga tekanan terhadap kesempurnaan dapat berkurang.",
                "Sebaiknya membagi tujuan besar menjadi pencapaian-pencapaian kecil yang bisa dinikmati prosesnya, agar semangat berprestasi tetap terjaga tanpa menimbulkan stres berlebihan.",
                "Direkomendasikan untuk secara rutin merayakan keberhasilan kecil sebagai bentuk apresiasi diri, agar motivasi tetap positif dan tidak terkuras oleh ekspektasi yang terlalu tinggi.",
                "Penting untuk belajar menetapkan batas yang sehat antara usaha maksimal dan penerimaan terhadap hasil, sehingga semangat berprestasi menjadi pendorong yang sehat dan berkelanjutan."
            ]
        },
        {
            teks1: "Daya Tahan Stress",
            teks2: [
                "Kemampuan mempertahankan kinerja di tengah tekanan.",
                "Mampu tetap tenang dan produktif meskipun berada dalam situasi yang penuh tekanan.",
                "Menunjukkan ketangguhan dalam menjaga stabilitas emosi dan performa kerja saat menghadapi tantangan.",
                "Cukup handal dalam mengelola tekanan sehari-hari tanpa membiarkannya mengganggu hasil pekerjaan.",
                "Dikenal sebagai pribadi yang tidak mudah goyah ketika dihadapkan pada situasi yang penuh ketidakpastian."
            ],
            teks3: [
                "Kewalahan saat menghadapi tekanan yang berkepanjangan.",
                "Terkadang sulit memulihkan diri dengan cepat setelah periode tekanan yang berlangsung lama.",
                "Kapasitas dalam mengelola stres menurun secara signifikan ketika beban pekerjaan menumpuk dalam waktu bersamaan.",
                "Cenderung mengalami penurunan produktivitas apabila tekanan terus-menerus berlangsung tanpa jeda pemulihan.",
                "Perlu strategi yang lebih baik dalam mengelola energi agar ketahanan terhadap tekanan jangka panjang meningkat."
            ],
            teks5: [
                "Sebaiknya mempraktikkan teknik relaksasi dan manajemen waktu yang efektif, sehingga dapat mengurangi stres dan meningkatkan performa dalam menghadapi tekanan.",
                "Sangat dianjurkan untuk membangun rutinitas pemulihan harian seperti olahraga ringan atau meditasi, agar kapasitas dalam menghadapi tekanan jangka panjang semakin meningkat.",
                "Disarankan untuk belajar mengenali tanda-tanda awal kelelahan emosional dan segera mengambil langkah pemulihan, sehingga burnout dapat dicegah sebelum berdampak pada kinerja.",
                "Penting untuk membangun support system yang kuat di lingkungan kerja, agar ada tempat berbagi beban ketika tekanan terasa terlalu berat untuk ditanggung sendiri.",
                "Direkomendasikan untuk secara rutin menjadwalkan waktu istirahat di sela-sela pekerjaan padat, guna menjaga stamina mental agar tetap optimal dalam jangka panjang."
            ]
        },
        {
            teks1: "Kepercayaan Diri",
            teks2: [
                "Adanya keyakinan terhadap kemampuan yang dimiliki.",
                "Menampilkan sikap yang percaya diri dalam menyampaikan pendapat dan mengambil tindakan.",
                "Mampu tampil tenang dan meyakinkan dalam situasi yang membutuhkan keberanian untuk maju.",
                "Memiliki self-esteem yang cukup kuat sehingga tidak mudah goyah oleh penilaian negatif dari luar.",
                "Dikenal sebagai pribadi yang berani mengekspresikan diri dan tidak ragu mengambil peran aktif."
            ],
            teks3: [
                "Kurang terbuka terhadap kritik konstruktif, yang menghambat perkembangan.",
                "Terkadang merespons kritik secara defensif sehingga peluang untuk belajar dari masukan menjadi terbatas.",
                "Cenderung merasa tidak nyaman ketika mendapat evaluasi negatif, meskipun disampaikan dengan niat yang baik.",
                "Perlu meningkatkan kemampuan menerima umpan balik secara terbuka agar potensi pengembangan diri dapat dimaksimalkan.",
                "Kadang terlalu terikat pada cara pandang sendiri sehingga sulit mempertimbangkan perspektif orang lain secara adil."
            ],
            teks5: [
                "Disarankan untuk secara rutin meminta umpan balik dari orang lain, sehingga dapat membangun kepercayaan diri yang lebih solid dan meningkatkan kemampuan untuk menerima kritik.",
                "Sangat bermanfaat untuk melatih diri memisahkan antara kritik terhadap pekerjaan dan penilaian terhadap diri sendiri, agar masukan dapat diterima secara lebih objektif.",
                "Penting untuk membangun perspektif bahwa kritik konstruktif adalah alat bantu pertumbuhan, bukan serangan personal, sehingga respons terhadapnya menjadi lebih terbuka.",
                "Direkomendasikan untuk mencari mentor atau rekan yang dipercaya dan secara aktif mendiskusikan area pengembangan diri, agar proses menerima masukan menjadi lebih terbiasa dan nyaman.",
                "Sebaiknya membiasakan diri untuk melakukan refleksi diri secara teratur, sehingga penerimaan terhadap kekurangan menjadi lebih lapang dan terbuka untuk perbaikan."
            ]
        },
        {
            teks1: "Relasi Sosial",
            teks2: [
                "Kemampuan membina hubungan dengan orang lain.",
                "Memiliki kemampuan interpersonal yang baik dalam membangun kedekatan dan kepercayaan.",
                "Dikenal mudah bergaul dan mampu menjaga hubungan yang positif dengan berbagai kalangan.",
                "Terampil dalam menciptakan suasana yang nyaman sehingga orang lain merasa dihargai dan didengar.",
                "Menunjukkan empati yang tulus dalam berinteraksi, sehingga hubungan yang dijalin cenderung bertahan lama."
            ],
            teks3: [
                "Canggung dalam situasi sosial baru, yang menghambat interaksi.",
                "Terkadang membutuhkan waktu lebih lama untuk merasa nyaman dan terbuka di lingkungan yang belum dikenal.",
                "Cenderung menarik diri terlebih dahulu ketika berada di antara orang-orang baru sebelum mulai berinteraksi.",
                "Perlu peningkatan dalam kemampuan beradaptasi secara sosial agar dapat lebih cepat menyesuaikan diri di lingkungan baru.",
                "Kadang terkesan kurang inisiatif dalam memulai percakapan dengan orang yang baru dikenal."
            ],
            teks5: [
                "Sangat dianjurkan untuk bergabung dengan kelompok sosial atau komunitas yang diminati, sehingga dapat berlatih keterampilan interaksi dan membangun hubungan yang lebih baik.",
                "Disarankan untuk secara aktif mencari kesempatan untuk berkenalan dengan orang-orang baru dalam berbagai kegiatan, agar rasa canggung dalam situasi sosial baru dapat berkurang.",
                "Penting untuk membiasakan diri mengambil inisiatif memulai percakapan kecil dalam pertemuan atau acara, sebagai latihan untuk membangun kepercayaan diri sosial secara bertahap.",
                "Sebaiknya mulai dengan lingkungan yang lebih kecil dan nyaman terlebih dahulu, lalu secara bertahap perluas jaringan sosial ke lingkaran yang lebih luas.",
                "Direkomendasikan untuk mengikuti kegiatan sosial atau komunitas secara rutin, sehingga keterampilan berinteraksi dengan orang baru dapat terus terasah dan rasa percaya diri sosial meningkat."
            ]
        },
        {
            teks1: "Kerjasama",
            teks2: [
                "Kemampuan bekerjasama individu atau berkelompok.",
                "Mampu berkontribusi secara positif dalam lingkungan kerja tim maupun individu.",
                "Menunjukkan sikap kooperatif yang mendukung terciptanya sinergi dalam kelompok.",
                "Dikenal sebagai rekan kerja yang dapat diandalkan dan mendukung keberhasilan tim.",
                "Memiliki kemampuan yang baik dalam menyelaraskan kepentingan pribadi dengan tujuan bersama kelompok."
            ],
            teks3: [
                "Kesulitan beradaptasi dengan dinamika kelompok yang berbeda.",
                "Terkadang kurang fleksibel ketika harus menyesuaikan gaya kerja dengan anggota tim yang memiliki karakter berbeda.",
                "Cenderung merasa tidak nyaman dalam kelompok yang memiliki cara kerja atau nilai yang berbeda dari kebiasaannya.",
                "Perlu peningkatan dalam kemampuan memahami dan menghargai perbedaan gaya kerja antar anggota tim.",
                "Kadang kesulitan membangun chemistry yang baik dengan kelompok baru dalam waktu singkat."
            ],
            teks5: [
                "Disarankan untuk terlibat dalam berbagai aktivitas kelompok yang memerlukan kolaborasi, agar dapat meningkatkan kemampuan untuk beradaptasi dengan berbagai dinamika kelompok.",
                "Sangat dianjurkan untuk secara aktif terlibat dalam proyek lintas tim, sehingga pengalaman bekerja dengan berbagai karakter orang dapat memperluas fleksibilitas dalam berkolaborasi.",
                "Penting untuk belajar memahami gaya kerja dan motivasi orang lain sebelum memulai kerja sama, agar penyesuaian dapat berlangsung lebih cepat dan harmonis.",
                "Sebaiknya mengambil inisiatif untuk mengenal anggota tim baru secara personal, karena kedekatan interpersonal yang dibangun lebih awal akan memperlancar kolaborasi di kemudian hari.",
                "Direkomendasikan untuk mengikuti pelatihan teamwork atau workshop kolaborasi, agar kemampuan beradaptasi dalam berbagai dinamika kelompok semakin meningkat."
            ]
        },
        {
            teks1: "Sistematika Kerja",
            teks2: [
                "Kemampuan membuat perencanaan & prioritas kerja.",
                "Terorganisir dengan baik dalam menyusun rencana dan mengatur prioritas pekerjaan.",
                "Memiliki pendekatan yang terstruktur sehingga setiap pekerjaan dapat diselesaikan secara efisien.",
                "Dikenal teliti dalam merancang alur kerja yang jelas dan dapat diikuti secara konsisten.",
                "Mampu mengelola berbagai tugas secara paralel dengan tetap menjaga keteraturan dan fokus."
            ],
            teks3: [
                "Terlalu fokus pada perencanaan, sehingga mengabaikan implementasi.",
                "Cenderung menghabiskan terlalu banyak waktu dalam fase perencanaan hingga menunda tahap pelaksanaan.",
                "Terkadang terjebak dalam perfeksionisme perencanaan sehingga eksekusi menjadi terlambat.",
                "Perlu meningkatkan keseimbangan antara kedalaman perencanaan dan kecepatan dalam memulai implementasi.",
                "Kadang sulit melepaskan fase persiapan dan beralih ke aksi nyata ketika rencana dirasa belum sempurna."
            ],
            teks5: [
                "Sebaiknya tentukan batas waktu untuk setiap fase implementasi, agar tidak terjebak dalam perencanaan yang berlarut-larut dan dapat segera memulai eksekusi.",
                "Disarankan untuk menerapkan prinsip 'good enough to start' dalam setiap perencanaan, yaitu memulai eksekusi ketika rencana sudah cukup solid meski belum sempurna.",
                "Penting untuk membiasakan diri menetapkan tenggat waktu yang ketat untuk setiap tahap perencanaan, sehingga energi dan waktu tidak habis sebelum eksekusi dimulai.",
                "Direkomendasikan untuk menggunakan metode manajemen proyek seperti Agile atau sprint planning, agar keseimbangan antara perencanaan dan pelaksanaan dapat terjaga dengan lebih baik.",
                "Sebaiknya belajar menerima bahwa rencana yang sempurna tidak selalu mungkin dicapai, dan bahwa tindakan nyata yang terarah jauh lebih berharga daripada rencana yang tak pernah dieksekusi."
            ]
        },
        {
            teks1: "Inisiatif",
            teks2: [
                "Kemampuan mengambil tindakan yang diperlukan.",
                "Tidak menunggu instruksi dan mampu secara mandiri mengidentifikasi langkah yang perlu diambil.",
                "Proaktif dalam melihat peluang dan segera bertindak untuk memanfaatkannya.",
                "Dikenal sebagai pribadi yang berani menjadi yang pertama bertindak ketika situasi membutuhkan.",
                "Menunjukkan keberanian untuk mengambil langkah awal tanpa harus selalu menunggu arahan dari pihak lain."
            ],
            teks3: [
                "Pengambilan keputusan yang terburu-buru berisiko tinggi.",
                "Terkadang bertindak terlalu cepat sebelum mempertimbangkan secara matang dampak dari keputusan yang diambil.",
                "Kecenderungan untuk segera bertindak kadang mengabaikan analisis risiko yang perlu dilakukan terlebih dahulu.",
                "Perlu peningkatan dalam mempertimbangkan konsekuensi jangka panjang sebelum mengambil inisiatif yang berisiko.",
                "Kadang semangat untuk bertindak cepat justru menghasilkan keputusan yang kurang matang dan memerlukan koreksi di kemudian hari."
            ],
            teks5: [
                "Disarankan untuk selalu mempertimbangkan pro dan kontra secara mendalam sebelum mengambil keputusan, agar dapat mengurangi risiko yang mungkin timbul dari keputusan yang terburu-buru.",
                "Sangat penting untuk membiasakan diri melakukan jeda singkat sebelum bertindak, guna memastikan keputusan yang diambil sudah mempertimbangkan berbagai aspek secara proporsional.",
                "Direkomendasikan untuk membangun kebiasaan konsultasi singkat dengan rekan terpercaya sebelum mengeksekusi inisiatif besar, sehingga risiko dapat dimitigasi lebih awal.",
                "Sebaiknya mempelajari teknik analisis risiko sederhana yang bisa diterapkan secara cepat, agar keputusan yang diambil tetap berani namun tetap terukur dan bertanggung jawab.",
                "Penting untuk mengembangkan kesadaran bahwa inisiatif yang baik bukan hanya soal kecepatan bertindak, tetapi juga soal ketepatan waktu dan kematangan pertimbangan sebelumnya."
            ]
        },
        {
            teks1: "Kemandirian",
            teks2: [
                "Kemampuan mengambil sikap dan bekerja sendiri.",
                "Mampu menyelesaikan pekerjaan secara mandiri tanpa harus bergantung pada arahan terus-menerus.",
                "Menunjukkan kemandirian yang tinggi dalam membuat keputusan dan mengeksekusi tugas secara independen.",
                "Dikenal tidak mudah terpengaruh oleh tekanan eksternal dan mampu mempertahankan pendirian secara konsisten.",
                "Memiliki otonomi kerja yang kuat sehingga mampu dipercaya untuk mengelola tanggung jawab secara penuh."
            ],
            teks3: [
                "Kesulitan dalam berkolaborasi dengan tim, yang dapat memengaruhi hasil kerja.",
                "Terkadang lebih nyaman bekerja sendiri hingga kurang optimal dalam situasi yang menuntut kolaborasi erat.",
                "Cenderung menyukai kendali penuh atas pekerjaan sehingga kurang memberi ruang bagi kontribusi orang lain.",
                "Perlu peningkatan dalam kemampuan berbagi peran dan tanggung jawab agar sinergi tim dapat lebih dimaksimalkan.",
                "Kadang independensi yang tinggi membuat kesulitan dalam menerima bantuan atau delegasi dari rekan kerja."
            ],
            teks5: [
                "Sangat penting untuk terlibat dalam proyek kolaboratif yang dapat membantu meningkatkan keterampilan kerja sama dan beradaptasi dalam lingkungan tim.",
                "Disarankan untuk secara sadar melatih diri memberikan kepercayaan kepada rekan kerja untuk mengerjakan bagian tertentu, sehingga kemampuan berkolaborasi dapat berkembang secara bertahap.",
                "Penting untuk memahami bahwa kemandirian dan kolaborasi bukan dua hal yang bertentangan, melainkan dua kekuatan yang perlu diseimbangkan untuk mencapai hasil terbaik.",
                "Direkomendasikan untuk aktif terlibat dalam sesi brainstorming atau pengerjaan proyek bersama, agar nilai dari perspektif dan kontribusi orang lain dapat lebih dihargai.",
                "Sebaiknya membiasakan diri untuk secara aktif meminta dan mempertimbangkan masukan dari rekan sebelum menyelesaikan pekerjaan secara mandiri, guna menghasilkan output yang lebih komprehensif."
            ]
        }
    ];

    const minatData = [
        {arah_minat:"OUTDOOR",        singkatan:"OUT",       keterangan_minat:"Minat ini melibatkan berbagai aktivitas di alam terbuka dan lapangan, termasuk eksplorasi lingkungan alam, pengelolaan sumber daya alam, serta kegiatan yang berhubungan dengan pertanian, kelautan, dan kebumian. Contoh jurusan: Kehutanan, Agroteknologi, Agribisnis, Ilmu Kelautan, Geografi."},
        {arah_minat:"LITERATURE",     singkatan:"LITE",      keterangan_minat:"Bidang ini berfokus pada kemampuan berbahasa, membaca, menulis, dan mengolah informasi secara tertulis maupun lisan. Seseorang dengan minat ini cenderung menyukai karya tulis, analisis teks, serta penyebaran dan pengelolaan informasi. Contoh jurusan: Sastra Indonesia, Sastra Inggris, Pendidikan Bahasa Indonesia, Pendidikan Bahasa Inggris, Ilmu Komunikasi."},
        {arah_minat:"MECHANICAL",     singkatan:"MECH",      keterangan_minat:"Minat ini terkait dengan dunia mesin, teknologi, dan sistem mekanik. Seseorang dengan minat ini tertarik pada cara kerja peralatan, perancangan sistem teknik, serta pembangunan infrastruktur fisik. Contoh jurusan: Teknik Mesin, Teknik Industri, Teknik Elektro, Teknik Otomotif, Teknik Perkapalan."},
        {arah_minat:"MUSICAL",        singkatan:"MUS",       keterangan_minat:"Minat di bidang musik mencakup kepekaan terhadap nada, ritme, dan ekspresi artistik melalui bunyi. Seseorang dengan minat ini menikmati menciptakan, memainkan, atau menginterpretasikan karya musik dalam berbagai bentuk dan kesempatan. Contoh jurusan: Seni Musik, Pendidikan Musik, Seni Pertunjukan, Karawitan, Etnomusikologi."},
        {arah_minat:"COMPUTATIONAL",  singkatan:"COMP",      keterangan_minat:"Bidang ini berfokus pada kemampuan berpikir analitis, bekerja dengan angka, data, dan perhitungan secara sistematis. Seseorang dengan minat ini nyaman dengan logika kuantitatif dan pengelolaan data keuangan maupun statistik. Contoh jurusan: Akuntansi, Statistika, Matematika, Aktuaria, Sistem Informasi."},
        {arah_minat:"SOCIAL SERVICE", singkatan:"SOS. WERV", keterangan_minat:"Minat ini berkaitan dengan keinginan untuk membantu, mendampingi, dan memberikan dukungan kepada orang lain. Seseorang dengan minat ini memiliki kepedulian sosial yang tinggi dan senang berkontribusi dalam kegiatan yang berdampak langsung pada masyarakat. Contoh jurusan: Psikologi, Bimbingan dan Konseling, Kesejahteraan Sosial, Sosiologi, Pendidikan Guru Sekolah Dasar (PGSD)."},
        {arah_minat:"SCIENTIFIC",     singkatan:"ACIE",      keterangan_minat:"Minat di bidang saintifik melibatkan ketertarikan pada penelitian, eksperimen, dan pengembangan ilmu pengetahuan secara sistematis. Seseorang dengan minat ini senang mengamati fenomena alam, menguji hipotesis, dan menemukan pemahaman baru melalui metode ilmiah. Contoh jurusan: Biologi, Kimia, Fisika, Farmasi, Bioteknologi."},
        {arah_minat:"CLERICAL",       singkatan:"CLER",      keterangan_minat:"Bidang ini berfokus pada pekerjaan yang terstruktur, rapi, dan berorientasi pada pengelolaan dokumen, jadwal, serta administrasi organisasi. Seseorang dengan minat ini menyukai keteraturan, ketelitian, dan koordinasi dalam lingkungan kerja formal. Contoh jurusan: Administrasi Perkantoran, Manajemen, Administrasi Bisnis, Perpustakaan dan Sains Informasi, Manajemen Perkantoran (Vokasi)."},
        {arah_minat:"PERSUASIVE",     singkatan:"PERS",      keterangan_minat:"Minat ini berhubungan dengan kemampuan mempengaruhi, meyakinkan, dan memimpin orang lain menuju suatu tujuan. Seseorang dengan minat ini nyaman berbicara di depan umum, bernegosiasi, dan membangun jaringan dalam lingkungan bisnis maupun organisasi. Contoh jurusan: Manajemen, Ilmu Komunikasi, Administrasi Bisnis, Hubungan Internasional, Ilmu Administrasi Negara."},
        {arah_minat:"PRACTICAL",      singkatan:"PRAC",      keterangan_minat:"Minat ini berfokus pada penerapan keterampilan teknis secara langsung di lapangan. Seseorang dengan minat ini senang bekerja dengan tangan, mengoperasikan peralatan, dan menyelesaikan masalah teknis yang nyata dan terukur. Contoh jurusan: Teknik Sipil, Teknik Lingkungan, Teknologi Pangan, Teknologi Industri Pertanian, Teknik Geologi."},
        {arah_minat:"AESTHETIC",      singkatan:"AESTH",     keterangan_minat:"Minat ini mencakup kepekaan terhadap keindahan, kreativitas, dan ekspresi visual. Seseorang dengan minat ini menikmati proses menciptakan karya yang memiliki nilai estetika, baik dalam bentuk desain, seni rupa, maupun media visual lainnya. Contoh jurusan: Desain Komunikasi Visual, Desain Interior, Desain Produk, Seni Rupa, Film dan Televisi."},
        {arah_minat:"MEDICAL",        singkatan:"MED",       keterangan_minat:"Minat ini berkaitan dengan kepedulian terhadap kesehatan manusia dan keinginan untuk berkontribusi dalam pelayanan medis. Seseorang dengan minat ini tertarik pada ilmu kesehatan, diagnosis, perawatan, serta upaya pencegahan penyakit demi meningkatkan kualitas hidup masyarakat. Contoh jurusan: Kedokteran, Kedokteran Gigi, Keperawatan, Kesehatan Masyarakat, Ilmu Gizi."}
    ];

    const aspekPsikologis = [
        // [section_header, nama_aspek, keterangan]  — section null = tidak ada header baru
        ['KEMAMPUAN',  'Kemampuan Umum',           'Mampu menemukan solusi untuk berbagai masalah dengan efektif.'],
        [null,         'Daya Tangkap Visual',       'Cepat mengenali pola dan perbedaan di lingkungan sekitar.'],
        [null,         'Kemampuan Berpikir Logis',  'Mampu membuat keputusan berdasarkan alasan yang jelas dalam situasi tertentu.'],
        [null,         'Kemampuan Berpikir Abstrak','Mampu melihat hubungan antara berbagai hal dan memahami konsekuensi dari tindakan.'],
        [null,         'Penalaran Verbal',          'Mampu berkomunikasi dengan jelas dan efektif dalam interaksi.'],
        [null,         'Penalaran Numerik',         'Kemampuan memahami proses hitung dan berpikir teratur'],
        ['KEPRIBADIAN','Hasrat Berprestasi',        'Keinginan untuk mencapai dan meningkatkan prestasi'],
        [null,         'Daya Tahan Stress',         'Kemampuan mempertahankan kinerja'],
        [null,         'Kepercayaan Diri',          'Adanya keyakinan terhadap kemampuan yang dimiliki'],
        [null,         'Relasi Sosial',             'Kemampuan membina hubungan dengan orang lain'],
        [null,         'Kerjasama',                 'Kemampuan bekerjasama individu atau berkelompok'],
        ['SIKAP KERJA','Sistematika Kerja',         'Kemampuan membuat perencanaan & prioritas kerja'],
        [null,         'Inisiatif',                 'Kemampuan mengambil tindakan yang diperlukan'],
        [null,         'Kemandirian',               'Kemampuan mengambil sikap dan bekerja sendiri']
    ];

    // =========================================================
    // EXPORT: semua yang dibutuhkan file tampilan
    // =========================================================
    global.PsikogramEngine = {
        // Fungsi utama — panggil xxini dari psikogram.html
        hitungPsikogram,
        // Data statis — dipakai untuk render teks default
        kekuatanKelemahan,
        minatData,
        aspekPsikologis
    };

})(window);