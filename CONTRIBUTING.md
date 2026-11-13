<div dir="rtl">

# المساهمة في «شَكِّل»

شَكِّل لعبة يومية: تظهر جملة قصيرة بلا تشكيل، وعلى اللاعب أن يضع حركاتها في ست محاولات، ثم يرى إعراب كل كلمة. كل جملة في اللعبة ملف صغير في هذا المستودع، ويمكنك إضافة جملك بإحدى طريقتين.

## الطريقة الأولى: نموذج الاقتراح (لا يحتاج خبرة تقنية)

1. افتح [نموذج «اقتراح جملة»](https://github.com/Beroean/mahmoud-shaar/issues/new?template=shakkil-sentence.yml) (تحتاج حسابًا مجانيًا على GitHub).
2. اكتب الجملة مشكولة، والإعراب، واسمك إن أردت.
3. نراجعها ونضيفها، وستظهر في اللعبة عندما يحين دورها.

## الطريقة الثانية: إضافة الملف بنفسك

كل جملة ملف في المجلد [`content/shakkil/puzzles`](content/shakkil/puzzles)، واسمه رقم من أربع خانات: `0001.yaml` و`0002.yaml`… **الرقم معرّف ثابت للجملة، وليس يوم ظهورها**. يحدد المشرف ترتيب الأيام في [`content/shakkil/schedule.yaml`](content/shakkil/schedule.yaml).

1. افتح المجلد على GitHub واختر **Add file ← Create new file**.
2. سمِّ الملف بالرقم التالي لآخر ملف موجود (إن كان آخر ملف `0042.yaml` فسمِّه `0043.yaml`).
3. الصق القالب التالي وعدّله:

```yaml
text: ذَهَبَ الْوَلَدُ إِلَى الْمَدْرَسَةِ
irab:
  - فعل ماضٍ مبني على الفتح
  - فاعل مرفوع وعلامة رفعه الضمة الظاهرة
  - حرف جر مبني على السكون
  - اسم مجرور وعلامة جره الكسرة الظاهرة
alts: []
author: اسمك
source: original
```

4. اختر **Propose new file** ثم **Create pull request**.
5. يفحص النظام الملف تلقائيًا ويكتب تعليقًا في الطلب فيه جدول يبيّن الحروف المطلوب تشكيلها والاختيارية، أو الأخطاء إن وُجدت. صحّح الأخطاء في الملف نفسه وسيُعاد الفحص.
6. بعد مراجعة الإعراب ودمج الطلب تُنشر الجملة على الموقع خلال دقائق.

إن سبقك أحد إلى الرقم نفسه فسنطلب منك تغيير اسم الملف إلى الرقم التالي.

## الحقول

| الحقل | مطلوب؟ | الوصف |
|---|---|---|
| `text` | نعم | الجملة مشكولة تشكيلًا كاملًا، من كلمتين إلى أربع. |
| `irab` | نعم | إعراب مختصر لكل كلمة بالترتيب، سطر لكل كلمة يبدأ بـ `- `. |
| `alts` | لا | تشكيلات أخرى صحيحة تمامًا للجملة نفسها، مثل `["قَرَأْتَ الْكِتَابَ"]`. يُقبل جواب اللاعب إن طابق أيًّا منها. |
| `author` | لا | الاسم الذي يظهر في نتيجة اللعبة. |
| `source` | لا | `original` (من تأليفك)، أو `tashkeela`، أو `llm-reviewed`. |

## قواعد التشكيل في اللعبة

- **شكّل كل حرف**: الحركة والشدة وعلامة الإعراب. يرفض الفحص أي حرف بلا تشكيل إلا الحروف التالية.
- **لا تُشكَّل**: الألف (ا آ ى ٱ)، وحرفا المد الواو والياء بعد الضمة والكسرة، وألف «ال»، واللام الشمسية (الشَّمس)، والحرف الذي فوقه ألف خنجرية (هٰذا).
- **اختياري للاعب**: السكون داخل الكلمة، والحركة التي قبل حرف المد (فتحة «كِتَاب»). لكن اكتبها في الملف كاملة.
- **مطلوب من اللاعب**: الشدة، وعلامة آخر الكلمة، بما فيها السكون في آخر الكلمة (لم يذهبْ، مِنْ).
- **تنوين الفتح** قبل الألف يُكتب على الحرف (كِتَابًا) أو على الألف (كِتَاباً)، والاثنان سواء.
- علامات الترقيم في أول الكلمة وآخرها مسموحة (، . ؟ ! « »).

## ما الجملة الجيدة؟

- قصيرة، مفهومة وحدها، من العربية الفصحى المعاصرة.
- فيها شيء يستحق التفكير: علامة إعراب، أو شدة، أو حرف يلتبس تشكيله.
- لها تشكيل واحد واضح، أو اذكر البدائل الصحيحة في `alts`.
- بلا محتوى سياسي أو ديني خلافي أو مسيء.

## الترخيص

تُنشر الجمل وإعرابها بترخيص [CC BY-NC 4.0](content/shakkil/LICENSE): يجوز مشاركتها وتعديلها لأغراض غير تجارية مع ذكر المصدر. بإرسالك جملة توافق على نشرها بهذا الترخيص. أما شيفرة الموقع فجميع حقوقها محفوظة ([LICENSE](LICENSE)).

## للمطوّرين

```bash
npm install
npm run puzzle:new -- "ذَهَبَ الْوَلَدُ إِلَى الْمَدْرَسَةِ"   # ينشئ الملف التالي
npm run puzzle:check -- 0043.yaml                      # يفحص الملف ويعرض طريقة التصحيح
npm run puzzle:check -- --text "هٰذَا كِتَابٌ"            # يجرّب جملة دون ملف
npm run schedule                                       # يعرض ترتيب الأيام
npm test
```

</div>

---

# Contributing to Shakkil (English)

Shakkil is a daily game: a short sentence appears without diacritics, the player adds them in up to six tries, then sees the i'rab of each word. Every sentence is a small YAML file in this repo.

## Option 1: suggestion form (no git needed)

Open the [sentence suggestion form](https://github.com/Beroean/mahmoud-shaar/issues/new?template=shakkil-sentence.yml), fill in the diacritized sentence and the i'rab, and a maintainer turns it into a puzzle file.

## Option 2: open a pull request

1. In [`content/shakkil/puzzles`](content/shakkil/puzzles), choose **Add file → Create new file**.
2. Name it with the next number after the last file (`0042.yaml` → `0043.yaml`). **The number is a permanent ID, not the day it runs**: the maintainer sets the order in [`content/shakkil/schedule.yaml`](content/shakkil/schedule.yaml).
3. Paste and edit the template above (`text`, `irab`, optional `alts`, `author`, `source`).
4. Propose the file and open a pull request.
5. The **Puzzle check** workflow validates the file and comments on the PR with a per-word table of required (●) and optional (○) marks, or with the errors to fix. Push fixes to rerun it.
6. Once the maintainer approves the i'rab and merges, the site redeploys within minutes.

Puzzles that have already been played are locked: the check fails if a PR deletes one or moves it to another day, and editing one is flagged.

### Rules in short

- Diacritize every letter, including shadda and the case ending. Bare letters are rejected except: alif forms (ا آ ى ٱ), long-vowel و/ي after damma/kasra, the alif of ال, the sun-letter lam, and a letter carrying a dagger alif.
- The player may leave out a word-internal sukun and the vowel before a long-vowel letter. Shadda and every word ending (including a final sukun) are required.
- Tanween fath before a final alif can be written on the letter or on the alif.
- `alts` lists other fully valid diacritizations; a guess matching any of them wins.

### License

Puzzle content (sentences, diacritization, i'rab) is published under [CC BY-NC 4.0](content/shakkil/LICENSE); by contributing you agree to that. The site's code is all rights reserved ([LICENSE](LICENSE)).

### Local tooling

`npm run puzzle:new`, `npm run puzzle:check` (validation and grading preview), `npm run schedule` (run order) and `npm test`. The grading rules live in `src/pages/shakkil/core/rules.ts`.
