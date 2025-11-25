// Hilft uns, das aktuelle Datum für Formulare zu bekommen (YYYY-MM-DD)
export function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getCurrentTimeString() {
    const now = new Date();
    return now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function getHoursDifference(startISO, endISO) {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const diffMs = end - start;
    return diffMs / (1000 * 60 * 60);
}

export function isOverlapping(startA, endA, startB, endB) {
    const sA = new Date(startA);
    const eA = new Date(endA);
    const sB = new Date(startB);
    const eB = new Date(endB);
    return sA < eB && eA > sB;
}

export function formatDate(dateInput) {
    const d = new Date(dateInput);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// --- NEU: KENNZEICHEN LOGIK & DATENBANK ---

// Liste aller gültigen deutschen KFZ-Kürzel (Auszug der wichtigsten + Logik für alle)
const VALID_CITIES = new Set([
    "A","AA","AB","ABG","ABI","AC","AE","AH","AIB","AIC","AK","ALF","AM","AN","ANA","ANG","ANK","AÖ","AP","APD","ARN","ART","AS","ASL","ASZ","AT","AU","AUR","AW","AZ",
    "B","BA","BAD","BAR","BB","BBG","BBL","BC","BCH","BD","BE","BED","BER","BF","BGD","BGL","BH","BI","BID","BIN","BIR","BIT","BIW","BK","BKS","BL","BLB","BLK","BM","BN","BNA","BO","BÖ","BOG","BOH","BOR","BOT","BP","BRA","BRB","BRG","BRK","BRL","BRV","BS","BSK","BT","BTF","BÜD","BÜS","BÜZ","BW","BWL","BYL","BZ",
    "C","CA","CAS","CB","CE","CHA","CLP","CLZ","CO","COC","COE","CR","CUX","CW",
    "D","DA","DAH","DAN","DAU","DBR","DD","DE","DEG","DEL","DGF","DH","DI","DIL","DIN","DIZ","DKB","DL","DLG","DM","DN","DO","DON","DU","DUD","DÜW","DW","DZ",
    "E","EA","EB","EBE","EBN","EBS","ECK","ED","EE","EF","EG","EH","EI","EIC","EIL","EIN","EIS","EL","EM","EMD","EMS","EN","ER","ERB","ERH","ERK","ERZ","ES","ESB","ESW","EU","EW","EY",
    "F","FB","FD","FDB","FDS","FE","FF","FFB","FG","FI","FKB","FL","FLÖ","FN","FO","FOR","FR","FRG","FRI","FRW","FS","FT","FTL","FÜ","FÜS","FW","FZ",
    "G","GA","GAP","GC","GD","GDB","GE","GEL","GEO","GER","GF","GG","GHA","GHC","GI","GIF","GK","GL","GLA","GM","GMN","GN","GNT","GÖ","GOA","GOH","GP","GR","GRA","GRH","GRI","GRM","GRZ","GS","GT","GTH","GÜ","GUB","GUN","GV","GW","GZ",
    "H","HA","HAL","HAM","HAS","HB","HBN","HBS","HC","HCH","HD","HDH","HDL","HE","HEB","HEF","HEI","HEL","HER","HET","HF","HG","HGN","HGW","HH","HHM","HI","HIG","HIP","HK","HL","HM","HMÜ","HN","HO","HOG","HOH","HOL","HOM","HOR","HÖS","HP","HR","HRO","HS","HSK","HST","HU","HVL","HWI","HX","HY","HZ",
    "I","IGB","IK","IL","ILL","IN","IZ",
    "J","JE","JL","JÜL",
    "K","KA","KB","KC","KE","KEH","KEL","KEM","KF","KG","KH","KI","KIB","KK","KL","KLE","KLZ","KM","KN","KO","KÖN","KÖT","KR","KRU","KS","KT","KU","KÜN","KUS","KY","KYF",
    "L","LA","LAN","LAU","LB","LBS","LBZ","LC","LD","LDK","LDS","LEO","LER","LEV","LG","LI","LIB","LIF","LIP","LL","LM","LÖ","LÖB","LOS","LP","LR","LRO","LSZ","LU","LÜN","LUP","LWL",
    "M","MA","MAB","MAI","MAK","MAL","MB","MC","MD","ME","MEI","MEK","MEL","MER","MET","MG","MGH","C","MH","MHL","MI","MIL","MK","MKK","ML","MM","MN","MO","MOD","MOL","MON","MOS","MQ","MR","MS","MSP","MST","MTK","MTL","MÜ","MÜR","MVL","MW","MY","MYK","MZ","MZG",
    "N","NB","ND","NDH","NE","NEA","NEB","NEC","NEN","NES","NEW","NF","NH","NI","NK","NM","NMB","NMS","NOH","NOL","NOM","NOR","NP","NR","NRÜ","NU","NVP","NW","NWM","NY","NZ",
    "OA","OAL","OB","OBB","OBG","OC","OCH","OD","OE","OF","OG","OH","OHA","OHV","OHZ","OK","OL","OLD","OP","OPR","OS","OSL","OVI","OVL","OVP",
    "P","PA","PAF","PAN","PB","PCH","PE","PEG","PF","PI","PIR","PL","PLÖ","PM","PN","PR","PRÜ","PS","PW",
    "QFT","QLB","QUER",
    "R","RA","RC","RD","RDG","RE","REG","REH","REI","RG","RH","RI","RIE","RL","RM","RO","ROF","ROK","ROL","ROS","ROT","ROW","RP","RS","RSL","RT","RÜD","RÜG","RV","RW","RZ",
    "S","SAB","SAD","SAW","SB","SBG","SBK","SC","SCZ","SDH","SDL","SDT","SE","SEB","SEE","SEF","SEL","SFB","SFT","SG","SGH","SH","SHA","SHG","SHK","SHL","SI","SIG","SIM","SK","SL","SLE","SLF","SLK","SLN","SLS","SLÜ","SLZ","SM","SMÜ","SN","SO","SOB","SOG","SOK","SÖM","SON","SP","SPN","SR","SRB","SRO","ST","STA","STB","STD","STE","STL","SU","SÜW","SW","SWA","SY","SZ","SZB",
    "T","BB","TDO","TE","TET","TF","TG","TIR","TO","TÖL","TP","TR","TS","TT","TÜ","TUT",
    "UE","UEM","UER","UH","UL","UM","UN","USI",
    "V","VB","VEC","VER","VG","VIE","VK","VOH","VR","VS",
    "W","WAF","WAK","WAN","WAT","WB","WBS","WDA","WE","WEL","WEN","WER","WES","WF","WG","WHV","WI","WIL","WIS","WIT","WIZ","WK","WL","WLG","WM","WMS","WN","WND","WO","WOB","WOH","WOL","WOR","WOS","WR","WRN","WS","WSF","WST","WSW","WT","WTM","WÜ","WUG","WUN","WUR","WW","WZ",
    "Z","ZE","ZEL","ZI","ZIG","ZP","ZR","ZW","ZZ"
]);

// Hilfsfunktion: Korrigiert Buchstaben/Zahlen-Verwechslung
function fixChar(char, expectNumber) {
    if (expectNumber) {
        return char.replace(/O/g, '0').replace(/I/g, '1').replace(/Z/g, '7').replace(/S/g, '5').replace(/B/g, '8').replace(/G/g, '6');
    } else {
        return char.replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B').replace(/5/g, 'S').replace(/4/g, 'A');
    }
}

// Die "KI"-Funktion
export function validateLicensePlate(text) {
    // 1. Grob reinigen
    let raw = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Wir probieren verschiedene Trennungen, beginnend von hinten (Zahlen)
    // Mindestens 1 Zahl am Ende
    const match = raw.match(/([A-Z0-9]+?)([0-9]{1,4})$/);
    
    if (!match) return { valid: false, text: text }; // Keine Zahlen am Ende -> Müll

    const lettersPart = match[1]; // "BGLAB"
    const numbersPart = match[2]; // "123"

    // Jetzt müssen wir den Buchstaben-Teil in STADT und ERKENNUNG trennen.
    // Da wir die VALID_CITIES haben, können wir prüfen!
    
    // Strategie: Wir testen Längen für die Stadt (1, 2, 3)
    let bestCity = "";
    let bestMid = "";
    let foundValidCity = false;

    // Teste Länge 3 (z.B. "BGL")
    if (lettersPart.length >= 4) { // Min 1 für Mid übrig
        const candidate = lettersPart.substring(lettersPart.length - 4, lettersPart.length - 1); // Letzte 3 vor dem Mid-Buchstaben? Nein, wir wissen nicht wo Mid anfängt.
        // Besser: Wir probieren von vorne, wenn wir annehmen dass davor Müll steht.
        // Aber wir haben ja "Reverse Matching" Logik.
        // Wir probieren alle sinnvollen Splits des `lettersPart`.
    }

    // Wir iterieren durch mögliche Stadt-Längen am ENDE des Letter-Parts
    // Beispiel lettersPart = "DBGLAB" (D = Müll, BGL = Stadt, AB = Mid)
    // Wir wissen nicht, wie viel Müll davor ist.
    
    // Wir probieren alle möglichen Positionen für den Split zwischen Stadt und Mid
    // Mid muss 1-2 Zeichen sein.
    // Stadt muss in VALID_CITIES sein.
    
    // Wir gehen von hinten durch `lettersPart`
    // AB (Mid 2) -> Rest davor ist Stadt-Kandidat
    // A (Mid 1) -> Rest davor ist Stadt-Kandidat

    const potentialMids = [];
    if (lettersPart.length >= 2) potentialMids.push(lettersPart.substring(lettersPart.length - 2)); // Letzte 2
    if (lettersPart.length >= 1) potentialMids.push(lettersPart.substring(lettersPart.length - 1)); // Letzte 1

    for (const mid of potentialMids) {
        // Der Rest davor könnte die Stadt sein
        // Wir nehmen die 1-3 Zeichen VOR dem Mid
        const remainingPrefix = lettersPart.substring(0, lettersPart.length - mid.length);
        
        // Versuche 1-3 Zeichen als Stadt zu extrahieren (von hinten gelesen)
        for (let len = 1; len <= 3; len++) {
            if (remainingPrefix.length >= len) {
                const cityCandidate = remainingPrefix.substring(remainingPrefix.length - len);
                // Fix Confusions (0 -> O) bevor wir prüfen
                const cityFixed = fixChar(cityCandidate, false);
                
                if (VALID_CITIES.has(cityFixed)) {
                    // TREFFER! Eine gültige Stadt gefunden.
                    return {
                        valid: true,
                        formatted: `${cityFixed}-${fixChar(mid, false)}-${fixChar(numbersPart, true)}`
                    };
                }
            }
        }
    }

    return { valid: false, text: text };
}