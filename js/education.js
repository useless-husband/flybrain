(function () {
    var EDUCATION_REGIONS = [
        {
            id: 'optic-lobes',
            name: 'Optic Lobes',
            nameZh: '視葉',
            neurons: ['VIS_R1R6', 'VIS_R7R8', 'VIS_ME', 'VIS_LO', 'VIS_LC', 'VIS_LPTC'],
            type: 'sensory',
            explanation: '視葉是蒼蠅的視覺處理中心，左右腦各一個。它負責偵測「動作、顏色、邊緣，以及迎面撲來的物體」。蒼蠅幾乎一半的腦都拿去處理視覺。',
            analogy: '就像你的視覺皮質 — 只是牠特別擅長偵測快速移動的東西，好閃過蒼蠅拍。',
            interaction: '把上面的「光線」從明亮切成昏暗或全黑，看視葉怎麼反應。',
            populationEstimate: '真實蒼蠅腦中約有 6 萬顆神經元'
        },
        {
            id: 'antennal-lobes',
            name: 'Antennal Lobes',
            nameZh: '觸角葉',
            neurons: ['OLF_ORN_FOOD', 'OLF_ORN_DANGER', 'OLF_LN', 'OLF_PN'],
            type: 'sensory',
            explanation: '觸角葉負責處理觸角聞到的氣味。不同的氣味會點亮不同的「嗅小球」（神經元叢集），蒼蠅就是靠這樣分辨「這是食物」還是「這是危險」。',
            analogy: '就像你的嗅球 — 氣味資訊送進大腦深處之前的第一站。',
            interaction: '在畫面上放食物，看嗅覺神經元在牠聞到的瞬間發亮。',
            populationEstimate: '約 2,600 顆神經元，分布在約 50 個嗅小球'
        },
        {
            id: 'mushroom-bodies',
            name: 'Mushroom Bodies',
            nameZh: '蕈狀體',
            neurons: ['MB_KC', 'MB_APL', 'MB_MBON_APP', 'MB_MBON_AV', 'MB_DAN_REW', 'MB_DAN_PUN'],
            type: 'central',
            explanation: '蕈狀體是蒼蠅的學習與記憶中心。它把氣味跟「獎勵」或「懲罰」連在一起，所以蒼蠅學得會哪種味道代表有東西吃、哪種代表快逃。',
            analogy: '相當於蒼蠅的海馬迴 — 負責形成和回想跟氣味有關的記憶。',
            interaction: '重複餵牠吃東西，看「獎勵多巴胺神經元」（DAN）跟凱尼恩細胞一起活躍起來。',
            populationEstimate: '約 2,000 顆凱尼恩細胞 + 約 400 顆輸出／多巴胺神經元'
        },
        {
            id: 'central-complex',
            name: 'Central Complex',
            nameZh: '中央複合體',
            neurons: ['CX_EPG', 'CX_PFN', 'CX_FC', 'CX_HDELTA', 'CLOCK_DN'],
            type: 'central',
            explanation: '中央複合體是蒼蠅的導航中樞。它維持一個「體內指南針」，隨時知道自己頭朝哪個方向，並協調走路的動作模式。',
            analogy: '像 GPS 加上方向盤 — 它知道蒼蠅現在面向哪裡，也負責規劃要往哪走。',
            interaction: '看蒼蠅走路、轉彎時，指南針神經元（EPG）怎麼變化。',
            populationEstimate: '真實蒼蠅腦中約有 3,000 顆神經元'
        },
        {
            id: 'lateral-horn',
            name: 'Lateral Horn',
            nameZh: '側角',
            neurons: ['LH_APP', 'LH_AV'],
            type: 'central',
            explanation: '側角負責對氣味的「天生反應」（不用學就會的那種）。蕈狀體要靠學習，側角則是直接觸發寫死在基因裡的靠近或逃跑。',
            analogy: '像本能反射 — 你手碰到燙的爐子，是先縮手才開始想「好燙」。',
            interaction: '把食物放在蒼蠅旁邊，看 LH_APP（靠近）被觸發。就算牠從沒學過，側角照樣有反應。',
            populationEstimate: '約 1,400 顆神經元'
        },
        {
            id: 'sez',
            name: 'Subesophageal Zone',
            nameZh: '食道下區',
            neurons: ['SEZ_FEED', 'SEZ_GROOM', 'SEZ_WATER', 'GUS_GRN_SWEET', 'GUS_GRN_BITTER', 'GUS_GRN_WATER', 'GNG_DESC'],
            type: 'central',
            explanation: '食道下區（SEZ）是進食和理毛的指揮中心。它處理味覺訊息，然後下令伸出口器吃東西、或是開始理毛。',
            analogy: '像餐廳的經理 — 聽味蕾回報之後，決定這東西到底要不要吃。',
            interaction: '餵牠吃東西，看 SEZ 亮起來。碰牠一下，則會觸發理毛指令。',
            populationEstimate: '約 7,000 顆神經元'
        },
        {
            id: 'vnc-motor',
            name: 'VNC / Motor',
            nameZh: '腹神經索／運動',
            neurons: ['DN_WALK', 'DN_FLIGHT', 'DN_TURN', 'DN_BACKUP', 'DN_STARTLE', 'VNC_CPG'],
            type: 'motor',
            collectMNPrefix: true,
            explanation: '腹神經索（VNC）相當於蒼蠅的脊髓。裡面有控制腳、翅膀、口器、腹部的運動神經元，還有負責產生走路這類規律動作的「中樞模式產生器」。',
            analogy: '像你的脊髓 — 把大腦的命令轉達給肌肉，並自行協調走路這種重複性動作。',
            interaction: '不管牠在做什麼，都看得到運動神經元在動 — 走路會點亮腿部運動神經，飛行會點亮翅膀的。',
            populationEstimate: '約 15,000 顆神經元（含運動神經元與中間神經元）'
        },
        {
            id: 'thermosensory',
            name: 'Thermosensory',
            nameZh: '溫度感覺',
            neurons: ['THERMO_WARM', 'THERMO_COOL'],
            type: 'sensory',
            explanation: '溫度感覺神經元負責偵測冷熱變化。熱感測器和冷感測器把溫度回報給大腦，蒼蠅才知道要往舒服的地方移動。',
            analogy: '像你皮膚裡的溫度接收器 — 告訴大腦現在是太熱還是太冷。',
            interaction: '把上面的「溫度」切成溫暖或涼爽，看對應的溫度神經元被啟動。',
            populationEstimate: '約 60 顆神經元'
        },
        {
            id: 'mechanosensory',
            name: 'Mechanosensory',
            nameZh: '機械感覺',
            neurons: ['MECH_BRISTLE', 'MECH_JO', 'MECH_CHORD', 'ANTENNAL_MECH', 'NOCI'],
            type: 'sensory',
            explanation: '機械感覺神經元負責偵測觸碰、風、重力和身體姿勢。剛毛神經元感應實際碰觸，江氏器透過觸角感應風和重力，弦音器則隨時追蹤四肢的位置。',
            analogy: '像你的觸覺，再加上內耳的平衡系統。',
            interaction: '碰蒼蠅一下會啟動剛毛神經元；對牠吹風則會啟動江氏器。',
            populationEstimate: '約 2,500 顆神經元'
        },
        {
            id: 'drives',
            name: 'Drives',
            nameZh: '內在驅力',
            neurons: ['DRIVE_HUNGER', 'DRIVE_FEAR', 'DRIVE_FATIGUE', 'DRIVE_CURIOSITY', 'DRIVE_GROOM'],
            type: 'drives',
            explanation: '驅力神經元代表牠內心的動機狀態。這些數值會隨時間起伏，並左右蒼蠅的行為 — 餓了就找食物，怕了就逃跑，累了就休息。',
            analogy: '就像你自己的飢餓感、焦慮感、疲倦感 — 看不見的內在狀態，卻決定你下一步要做什麼。',
            interaction: '看左下角那幾條驅力量表。飢餓會隨時間上升；你去碰牠或吹風，恐懼就會飆高。',
            populationEstimate: '分散在全腦 — 這裡簡化成 5 組功能群'
        }
    ];

    window.EducationPanel = {
        active: false,
        _initialized: false,
        _panel: null,
        _content: null,

        init: function () {
            EducationPanel._panel = document.getElementById('education-panel');
            var closeBtn = document.getElementById('education-close-btn');
            closeBtn.addEventListener('click', function () {
                EducationPanel.hide();
                var learnBtnEl = document.getElementById('learnBtn');
                if (learnBtnEl) learnBtnEl.classList.remove('active');
            });
            EducationPanel._content = document.getElementById('education-content');
            EducationPanel._buildContent();
            EducationPanel._initialized = true;
        },

        _buildContent: function () {
            var html = '';

            // Intro blurb
            html += '<p class="edu-text" style="margin-bottom:1rem;">這是果蠅大腦的簡化功能模型。畫面用 59 組神經元群，代表 FlyWire 團隊在 2024 年實際描繪出來的約 13 萬顆真實神經元。</p>';

            // Group regions by type for column layout
            var types = [
                { key: 'sensory', label: '感覺（輸入）', color: '#3b82f6' },
                { key: 'central', label: '中樞（思考）', color: '#8b5cf6' },
                { key: 'drives', label: '驅力（想要）', color: '#f59e0b' },
                { key: 'motor', label: '運動（輸出）', color: '#ef4444' }
            ];

            html += '<div class="edu-columns">';
            for (var t = 0; t < types.length; t++) {
                var type = types[t];
                html += '<div class="edu-column">';
                html += '<div class="edu-column-header edu-type-' + type.key + '">' + type.label + '</div>';
                for (var i = 0; i < EDUCATION_REGIONS.length; i++) {
                    var region = EDUCATION_REGIONS[i];
                    if (region.type !== type.key) continue;
                    html += '<div class="edu-region-card" data-region-id="' + region.id + '">';
                    html += '<span class="edu-region-link" data-region="' + region.name + '">' + (region.nameZh || region.name) + '</span>';
                    html += '</div>';
                }
                html += '</div>';
            }
            html += '</div>';

            // Signal flow diagram
            html += '<div class="edu-section" style="margin-top:1rem;">';
            html += '<h2 class="edu-section-title">訊號怎麼流動</h2>';
            html += '<svg class="edu-signal-flow" viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">';
            html += '<defs>';
            html += '<marker id="edu-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8892a4"/></marker>';
            html += '<marker id="edu-arrow-drives" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b"/></marker>';
            html += '</defs>';
            html += '<rect x="20" y="60" width="140" height="80" rx="8" fill="rgba(59,130,246,0.2)" stroke="#3b82f6"/>';
            html += '<text x="90" y="105" text-anchor="middle" fill="white" font-size="14">感覺</text>';
            html += '<rect x="230" y="40" width="140" height="120" rx="8" fill="rgba(139,92,246,0.2)" stroke="#8b5cf6"/>';
            html += '<text x="300" y="105" text-anchor="middle" fill="white" font-size="14">中樞</text>';
            html += '<rect x="440" y="60" width="140" height="80" rx="8" fill="rgba(239,68,68,0.2)" stroke="#ef4444"/>';
            html += '<text x="510" y="105" text-anchor="middle" fill="white" font-size="14">運動</text>';
            html += '<line x1="160" y1="100" x2="230" y2="100" stroke="#8892a4" stroke-width="2" marker-end="url(#edu-arrow)"/>';
            html += '<line x1="370" y1="100" x2="440" y2="100" stroke="#8892a4" stroke-width="2" marker-end="url(#edu-arrow)"/>';
            html += '<rect x="250" y="175" width="100" height="25" rx="4" fill="rgba(245,158,11,0.2)" stroke="#f59e0b"/>';
            html += '<text x="300" y="192" text-anchor="middle" fill="white" font-size="12">驅力</text>';
            html += '<line x1="300" y1="175" x2="300" y2="160" stroke="#f59e0b" stroke-dasharray="4,3" stroke-width="2" marker-end="url(#edu-arrow-drives)"/>';
            html += '</svg>';
            html += '</div>';

            // Expandable region detail (populated on click)
            html += '<div id="edu-detail" class="edu-detail-panel" style="display:none;"></div>';

            // Compact reference sections
            html += '<div class="edu-section">';
            html += '<h2 class="edu-section-title">這個模型簡化了哪些東西</h2>';
            html += '<ul class="edu-list">';
            html += '<li>畫面上的每一組，代表真實腦中成百上千顆神經元</li>';
            html += '<li>連線的強度是估算值，不是精確的突觸數量</li>';
            html += '<li>沒有模擬「突觸可塑性」，連線強度是固定的（所以牠不會真的學習）</li>';
            html += '<li>沒有模擬神經調節物質的擴散，也沒有電性突觸</li>';
            html += '</ul>';
            html += '</div>';

            html += '<div class="edu-section">';
            html += '<h2 class="edu-section-title">想更深入</h2>';
            html += '<ul class="edu-links">';
            html += '<li><a href="https://codex.flywire.ai" target="_blank" rel="noopener noreferrer">FlyWire Codex</a></li>';
            html += '<li><a href="https://doi.org/10.1038/s41586-024-07558-y" target="_blank" rel="noopener noreferrer">Dorkenwald et al. 2024</a></li>';
            html += '<li><a href="https://www.virtualflybrain.org" target="_blank" rel="noopener noreferrer">Virtual Fly Brain</a></li>';
            html += '</ul>';
            html += '</div>';

            EducationPanel._content.innerHTML = html;

            // Bind click handlers on each region card
            var cards = EducationPanel._content.querySelectorAll('.edu-region-card');
            for (var ci = 0; ci < cards.length; ci++) {
                (function (card) {
                    card.addEventListener('click', function () {
                        var regionId = card.getAttribute('data-region-id');
                        for (var r = 0; r < EDUCATION_REGIONS.length; r++) {
                            if (EDUCATION_REGIONS[r].id === regionId) {
                                EducationPanel._showDetail(EDUCATION_REGIONS[r]);
                                EducationPanel.highlightRegion(EDUCATION_REGIONS[r].name);
                                break;
                            }
                        }
                    });
                })(cards[ci]);
            }
        },

        _showDetail: function (region) {
            var detail = document.getElementById('edu-detail');
            if (!detail) return;
            var html = '<div class="edu-section">';
            var TYPE_ZH = { sensory: '感覺', central: '中樞', drives: '驅力', motor: '運動' };
            html += '<h2 class="edu-section-title"><span class="edu-region-link" data-region="' + region.name + '">' + (region.nameZh || region.name) + '</span><span class="edu-type-badge edu-type-' + region.type + '">' + (TYPE_ZH[region.type] || region.type) + '</span></h2>';
            html += '<p class="edu-orig-name">' + region.name + '</p>';
            html += '<p class="edu-text">' + region.explanation + '</p>';
            html += '<p class="edu-analogy"><strong>打個比方：</strong> ' + region.analogy + '</p>';
            html += '<p class="edu-interaction"><strong>動手試試：</strong> ' + region.interaction + '</p>';
            html += '<div class="edu-neuron-list"><strong>包含的神經元群組：</strong>';
            for (var j = 0; j < region.neurons.length; j++) {
                html += '<span class="edu-neuron-tag">' + region.neurons[j] + '</span>';
            }
            if (region.collectMNPrefix && typeof BRAIN !== 'undefined' && BRAIN.postSynaptic) {
                var keys = Object.keys(BRAIN.postSynaptic);
                for (var k = 0; k < keys.length; k++) {
                    if (keys[k].indexOf('MN_') === 0 && region.neurons.indexOf(keys[k]) === -1) {
                        html += '<span class="edu-neuron-tag">' + keys[k] + '</span>';
                    }
                }
            }
            html += '</div>';
            html += '<div class="edu-population">' + region.populationEstimate + '</div>';
            html += '</div>';
            detail.innerHTML = html;
            detail.style.display = 'block';
        },

        highlightRegion: function (regionName) {
            if (typeof Brain3D !== 'undefined' && Brain3D.highlightRegion) {
                Brain3D.highlightRegion(regionName);
            }
        },

        show: function () {
            if (!EducationPanel._initialized) EducationPanel.init();
            EducationPanel._panel.style.display = 'flex';
            EducationPanel.active = true;
        },

        hide: function () {
            EducationPanel._panel.style.display = 'none';
            EducationPanel.active = false;
        },

        toggle: function () {
            if (EducationPanel.active) {
                EducationPanel.hide();
            } else {
                EducationPanel.show();
            }
        }
    };
})();
