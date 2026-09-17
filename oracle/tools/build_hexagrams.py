"""
Generate hexagrams.json for the Oracle project.

Why generate instead of hand-writing the JSON:
each hexagram's six lines are NOT arbitrary data - they are fully determined by
which two trigrams sit on the bottom and top. Typing 64 x 6 binary digits by hand
is how you get one silently wrong hexagram that nobody notices for months.
Here the binary is DERIVED, and then checked (64 unique patterns, all 64 possible
6-bit values present exactly once).
"""
import json
import os

# Written next to the page that consumes it, one level up from tools/.
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "hexagrams.json")

# Trigram bits are written BOTTOM to TOP, which is the direction the I Ching reads.
# 1 = yang (solid line), 0 = yin (broken line).
TRIGRAMS = {
    "QIAN": {"bits": (1, 1, 1), "cn": "乾", "en": "Heaven"},
    "DUI":  {"bits": (1, 1, 0), "cn": "兌", "en": "Lake"},
    "LI":   {"bits": (1, 0, 1), "cn": "離", "en": "Fire"},
    "ZHEN": {"bits": (1, 0, 0), "cn": "震", "en": "Thunder"},
    "XUN":  {"bits": (0, 1, 1), "cn": "巽", "en": "Wind"},
    "KAN":  {"bits": (0, 1, 0), "cn": "坎", "en": "Water"},
    "GEN":  {"bits": (0, 0, 1), "cn": "艮", "en": "Mountain"},
    "KUN":  {"bits": (0, 0, 0), "cn": "坤", "en": "Earth"},
}

# King Wen sequence: (number, lower trigram, upper trigram, chinese, pinyin,
#                     english, classical judgment, modern one-line reading)
KING_WEN = [
    (1,  "QIAN", "QIAN", "乾",   "Qián",      "The Creative",
     "元亨利貞。", "Pure initiative. The situation is yours to start; nothing is waiting for permission."),
    (2,  "KUN",  "KUN",  "坤",   "Kūn",       "The Receptive",
     "元亨，利牝馬之貞。", "Carry rather than lead. Strength here looks like patience and capacity."),
    (3,  "ZHEN", "KAN",  "屯",   "Zhūn",      "Difficulty at the Beginning",
     "元亨利貞，勿用有攸往。", "The tangle at the start is normal, not a verdict. Do not push forward yet."),
    (4,  "KAN",  "GEN",  "蒙",   "Méng",      "Youthful Folly",
     "亨。匪我求童蒙，童蒙求我。", "You do not know enough yet, and that is fine. Ask; do not pretend."),
    (5,  "QIAN", "KAN",  "需",   "Xū",        "Waiting",
     "有孚，光亨，貞吉。", "Waiting is the action. The conditions are not ready, and forcing them costs more."),
    (6,  "KAN",  "QIAN", "訟",   "Sòng",      "Conflict",
     "有孚窒惕，中吉終凶。", "A dispute you can win is still a dispute you pay for. Stop halfway."),
    (7,  "KAN",  "KUN",  "師",   "Shī",       "The Army",
     "貞，丈人吉，无咎。", "This needs organisation, not enthusiasm. Someone has to be accountable."),
    (8,  "KUN",  "KAN",  "比",   "Bǐ",        "Holding Together",
     "吉。原筮元永貞，无咎。", "Alliance is available. Decide early whether you are in, rather than drifting in."),
    (9,  "QIAN", "XUN",  "小畜", "Xiǎo Chù",  "The Taming Power of the Small",
     "亨。密雲不雨。", "Clouds, no rain. Small accumulations only - the large move is not yet possible."),
    (10, "DUI",  "QIAN", "履",   "Lǚ",        "Treading",
     "履虎尾，不咥人，亨。", "You are closer to danger than you think, and conduct is what keeps you safe."),
    (11, "QIAN", "KUN",  "泰",   "Tài",       "Peace",
     "小往大來，吉亨。", "Things are moving in the right direction. Use the opening; it is not permanent."),
    (12, "KUN",  "QIAN", "否",   "Pǐ",        "Standstill",
     "否之匪人，不利君子貞。", "Communication has stopped. Withdraw rather than argue with a closed door."),
    (13, "LI",   "QIAN", "同人", "Tóng Rén",  "Fellowship with Others",
     "同人于野，亨。", "Find the people who share the aim. Do it in the open, not in a private clique."),
    (14, "QIAN", "LI",   "大有", "Dà Yǒu",    "Possession in Great Measure",
     "元亨。", "You have more than you are using. The problem is distribution, not scarcity."),
    (15, "GEN",  "KUN",  "謙",   "Qiān",      "Modesty",
     "亨，君子有終。", "Claim less than you could. It is the one position nobody attacks."),
    (16, "KUN",  "ZHEN", "豫",   "Yù",        "Enthusiasm",
     "利建侯行師。", "Energy is gathering and wants a direction. Give it one before it scatters."),
    (17, "ZHEN", "DUI",  "隨",   "Suí",       "Following",
     "元亨利貞，无咎。", "Adapt to what is actually happening. Leading here means going second, well."),
    (18, "XUN",  "GEN",  "蠱",   "Gǔ",        "Work on What Has Been Spoiled",
     "元亨，利涉大川。", "Something was neglected and has gone bad quietly. Repair beats blame."),
    (19, "DUI",  "KUN",  "臨",   "Lín",       "Approach",
     "元亨利貞。至于八月有凶。", "An opening is approaching. Its window is shorter than it feels."),
    (20, "KUN",  "XUN",  "觀",   "Guān",      "Contemplation",
     "盥而不薦，有孚顒若。", "Watch before you act. You are also being watched more than you realise."),
    (21, "ZHEN", "LI",   "噬嗑", "Shì Kè",    "Biting Through",
     "亨，利用獄。", "There is an obstruction that will not dissolve on its own. Name it directly."),
    (22, "LI",   "GEN",  "賁",   "Bì",        "Grace",
     "亨，小利有攸往。", "Form matters here, but only as form. Do not mistake presentation for substance."),
    (23, "KUN",  "GEN",  "剝",   "Bō",        "Splitting Apart",
     "不利有攸往。", "Something is coming apart and should be allowed to. Protect the core, drop the rest."),
    (24, "ZHEN", "KUN",  "復",   "Fù",        "Return",
     "亨。出入无疾，朋來无咎。", "The turning point has already happened, quietly. Begin again small."),
    (25, "ZHEN", "QIAN", "无妄", "Wú Wàng",   "Innocence",
     "元亨利貞。其匪正有眚。", "Act from the straightforward motive. Calculation will backfire here."),
    (26, "QIAN", "GEN",  "大畜", "Dà Chù",    "The Taming Power of the Great",
     "利貞，不家食吉。", "Hold the force back so it accumulates. Restraint is building something."),
    (27, "ZHEN", "GEN",  "頤",   "Yí",        "The Corners of the Mouth",
     "貞吉。觀頤，自求口實。", "Watch what you are feeding yourself - attention, company, information."),
    (28, "XUN",  "DUI",  "大過", "Dà Guò",    "Preponderance of the Great",
     "棟橈，利有攸往，亨。", "The load exceeds the structure. Something must be set down before it breaks."),
    (29, "KAN",  "KAN",  "坎",   "Kǎn",       "The Abysmal",
     "習坎，有孚，維心亨。", "Danger repeating. You get through by being consistent, not clever."),
    (30, "LI",   "LI",   "離",   "Lí",        "The Clinging",
     "利貞，亨。畜牝牛吉。", "Light depends on what it burns. Clarity here is borrowed, so tend the source."),
    (31, "GEN",  "DUI",  "咸",   "Xián",      "Influence",
     "亨，利貞，取女吉。", "Mutual attraction, still unspoken. Respond rather than strategise."),
    (32, "XUN",  "ZHEN", "恆",   "Héng",      "Duration",
     "亨，无咎，利貞，利有攸往。", "Endurance, not intensity. The question is what you can keep doing."),
    (33, "GEN",  "QIAN", "遯",   "Dùn",       "Retreat",
     "亨，小利貞。", "Withdrawing now is strategy, not defeat. Leave before you are forced to."),
    (34, "QIAN", "ZHEN", "大壯", "Dà Zhuàng", "The Power of the Great",
     "利貞。", "You have real force available. Force without a reason becomes a mistake."),
    (35, "KUN",  "LI",   "晉",   "Jìn",       "Progress",
     "康侯用錫馬蕃庶。", "Advancement is visible and sanctioned. Move openly, at the pace offered."),
    (36, "LI",   "KUN",  "明夷", "Míng Yí",   "Darkening of the Light",
     "利艱貞。", "The environment does not reward being seen clearly. Keep your own light lit inwardly."),
    (37, "LI",   "XUN",  "家人", "Jiā Rén",   "The Family",
     "利女貞。", "The small unit is what needs order. Fix the inside before addressing the outside."),
    (38, "DUI",  "LI",   "睽",   "Kuí",       "Opposition",
     "小事吉。", "You are pulling in different directions. Agree on small things; leave the large alone."),
    (39, "GEN",  "KAN",  "蹇",   "Jiǎn",      "Obstruction",
     "利西南，不利東北。", "The way ahead is blocked. Turning aside is not the same as giving up."),
    (40, "KAN",  "ZHEN", "解",   "Xiè",       "Deliverance",
     "利西南。无所往，其來復吉。", "The tension has broken. Do not immediately fill the space with new tension."),
    (41, "DUI",  "GEN",  "損",   "Sǔn",       "Decrease",
     "有孚，元吉，无咎。", "Give something up deliberately. Chosen loss is different from suffered loss."),
    (42, "ZHEN", "XUN",  "益",   "Yì",        "Increase",
     "利有攸往，利涉大川。", "A window where effort compounds. Spend it outward, not on yourself."),
    (43, "QIAN", "DUI",  "夬",   "Guài",      "Break-through",
     "揚于王庭，孚號有厲。", "The thing must be said out loud. Say it plainly and without contempt."),
    (44, "XUN",  "QIAN", "姤",   "Gòu",       "Coming to Meet",
     "女壯，勿用取女。", "Something small has entered that will not stay small. Notice it now."),
    (45, "KUN",  "DUI",  "萃",   "Cuì",       "Gathering Together",
     "亨。王假有廟。", "People are assembling. Gatherings need a centre or they become a crowd."),
    (46, "XUN",  "KUN",  "升",   "Shēng",     "Pushing Upward",
     "元亨，用見大人，勿恤。", "Growth by accumulation, step by step. It will not feel dramatic."),
    (47, "KAN",  "DUI",  "困",   "Kùn",       "Oppression",
     "亨，貞，大人吉，无咎。", "Constrained on all sides. Words carry no weight now; only conduct does."),
    (48, "XUN",  "KAN",  "井",   "Jǐng",      "The Well",
     "改邑不改井，无喪无得。", "The source is still there and still works. What needs repair is the access."),
    (49, "LI",   "DUI",  "革",   "Gé",        "Revolution",
     "巳日乃孚，元亨利貞。", "The old arrangement has lost its reason to exist. Change it on a stated day."),
    (50, "XUN",  "LI",   "鼎",   "Dǐng",      "The Cauldron",
     "元吉，亨。", "Raw material, transformed by a process. Build the vessel, not just the ambition."),
    (51, "ZHEN", "ZHEN", "震",   "Zhèn",      "The Arousing",
     "亨。震來虩虩，笑言啞啞。", "Shock arrives. The fright passes; what you do in the first minute matters."),
    (52, "GEN",  "GEN",  "艮",   "Gèn",       "Keeping Still",
     "艮其背，不獲其身。", "Stop. Not paused, not waiting for a signal - actually stop and be still."),
    (53, "GEN",  "XUN",  "漸",   "Jiàn",      "Development",
     "女歸吉，利貞。", "Gradual, in the correct order. Skipping a stage undoes the ones before it."),
    (54, "DUI",  "ZHEN", "歸妹", "Guī Mèi",   "The Marrying Maiden",
     "征凶，无攸利。", "You are entering on someone else's terms. Know that before you agree."),
    (55, "LI",   "ZHEN", "豐",   "Fēng",      "Abundance",
     "亨，王假之，勿憂。", "Peak. Enjoy it without pretending it is a plateau."),
    (56, "GEN",  "LI",   "旅",   "Lǚ",        "The Wanderer",
     "小亨，旅貞吉。", "You are a guest here, not a resident. Travel light and behave well."),
    (57, "XUN",  "XUN",  "巽",   "Xùn",       "The Gentle",
     "小亨，利有攸往。", "Persistent, low-pressure influence. Repetition works where argument does not."),
    (58, "DUI",  "DUI",  "兌",   "Duì",       "The Joyous",
     "亨，利貞。", "Open exchange, genuinely enjoyed. Keep it honest or it curdles into flattery."),
    (59, "KAN",  "XUN",  "渙",   "Huàn",      "Dispersion",
     "亨。王假有廟，利涉大川。", "Rigidity is dissolving. Let the hard thing break up before rebuilding."),
    (60, "DUI",  "KAN",  "節",   "Jié",       "Limitation",
     "亨。苦節不可貞。", "Set a limit and keep it. But a limit that hurts to hold is the wrong limit."),
    (61, "DUI",  "XUN",  "中孚", "Zhōng Fú",  "Inner Truth",
     "豚魚吉，利涉大川。", "Sincerity reaches further than technique here, including to people unlike you."),
    (62, "GEN",  "ZHEN", "小過", "Xiǎo Guò",  "Preponderance of the Small",
     "亨，利貞。可小事，不可大事。", "This is a season for small correct acts. The grand gesture will miss."),
    (63, "LI",   "KAN",  "既濟", "Jì Jì",     "After Completion",
     "亨小，利貞。初吉終亂。", "It is finished, and that is exactly when things start to slip. Maintain."),
    (64, "KAN",  "LI",   "未濟", "Wèi Jì",    "Before Completion",
     "亨。小狐汔濟，濡其尾。", "Almost there, and the last stretch is where it is lost. Do not relax yet."),
]


def build():
    out = []
    for num, lower, upper, cn, pinyin, en, judgment, reading in KING_WEN:
        lo = TRIGRAMS[lower]
        up = TRIGRAMS[upper]
        # Lines run BOTTOM to TOP: lower trigram first, then upper.
        lines = list(lo["bits"]) + list(up["bits"])
        out.append({
            "n": num,
            "lines": lines,
            "glyph": chr(0x4DC0 + num - 1),   # Unicode hexagram block, King Wen order
            "cn": cn,
            "pinyin": pinyin,
            "en": en,
            "judgment": judgment,
            "reading": reading,
            "lower": {"cn": lo["cn"], "en": lo["en"]},
            "upper": {"cn": up["cn"], "en": up["en"]},
        })
    return out


def validate(data):
    """Fail loudly rather than shipping a silently wrong hexagram."""
    assert len(data) == 64, f"expected 64 hexagrams, got {len(data)}"

    # Every hexagram's 6-bit pattern must be unique, and all 64 possible
    # patterns must appear exactly once.
    keys = ["".join(map(str, h["lines"])) for h in data]
    assert len(set(keys)) == 64, "duplicate line patterns found"
    assert len(keys[0]) == 6

    # Spot-check against hexagrams whose shape is common knowledge.
    known = {
        1:  [1, 1, 1, 1, 1, 1],   # 乾 all yang
        2:  [0, 0, 0, 0, 0, 0],   # 坤 all yin
        11: [1, 1, 1, 0, 0, 0],   # 泰 heaven below, earth above
        12: [0, 0, 0, 1, 1, 1],   # 否 earth below, heaven above
        63: [1, 0, 1, 0, 1, 0],   # 既濟 perfectly alternating
        64: [0, 1, 0, 1, 0, 1],   # 未濟 the other alternation
    }
    by_n = {h["n"]: h for h in data}
    for n, expect in known.items():
        got = by_n[n]["lines"]
        assert got == expect, f"hexagram {n} ({by_n[n]['cn']}): expected {expect}, got {got}"

    # The Unicode glyph block must line up with King Wen numbering.
    assert by_n[1]["glyph"] == "䷀"
    assert by_n[64]["glyph"] == "䷿"

    print(f"validated: 64 hexagrams, {len(set(keys))} unique patterns, spot-checks passed")


if __name__ == "__main__":
    data = build()
    validate(data)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print("wrote " + OUT_PATH)
    # Print a couple so the shape is visible in the log.
    for n in (1, 24, 64):
        h = next(x for x in data if x["n"] == n)
        print(f"  {h['n']:>2} {h['glyph']} {h['cn']} {h['pinyin']}  {h['lines']}  {h['lower']['en']}/{h['upper']['en']}")
