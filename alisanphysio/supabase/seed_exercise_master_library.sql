-- Alisan Exercise Master Library: 105 exercises, 14 source categories.
-- SEED DATA ONLY. Run this entire file manually in the Supabase SQL Editor.
-- Prepared from Alisan_Exercise_Master_Library.pdf; not executed by the author.
-- Live schema/data were NOT inspected, following the user's local-files-only choice.
-- Local schema: migrations 0002 and 0010. Categories also have created_at.
-- Does not require a unique name constraint: explicit case-insensitive existence
-- checks plus table locks prevent duplicate inserts, including concurrent writes.
-- Existing names, nonblank values, category flags and unrelated mappings survive.
-- If case-insensitive duplicates already exist, reuse the lowest UUID consistently;
-- expose match counts in the report, do not merge or delete existing records.
-- New source categories are custom categories (is_default = false).
--
-- Cleaning: remove leading Goal: and join PDF line wraps for all descriptions.
-- #2: remove leaked suffix "3 2/ Bench Press".
-- #49/#69: NULL instructions (section heading / different exercise's description).
-- #55/#56: NULL instructions (truncated mid-sentence).
-- #88: retain complete cue sentences before the ** fragment; discard client note.
-- #77: NULL video (source itself flags a duplicated/wrong link).
-- Source missing-video and missing-goal/cue placeholders become NULL.
-- Keep meaningful numbers, including #16's 90 degrees, #91's repetitions and
-- #104's circuit timing. Do not infer missing cues, videos or synonym matches.
-- Clean payload: 25 NULL videos, 19 NULL instructions. Existing authored values
-- may make the final missing-field counts lower; the result reports both.
--
-- The final SELECT returns totals, all 105 row actions, category actions and the
-- remaining attention list. A rerun with unchanged data inserts/updates nothing.
-- No permanent schema objects, functions, policies or columns are created.

begin;
lock table public.exercise_library, public.exercise_categories,
  public.exercise_category_map in share row exclusive mode;

with
source (pdf_number, name, category, youtube_url, default_instructions) as (
  values
  (1, 'Bench Press', 'Strength - Chest', 'https://youtu.be/SCVCLChPQFY?si=r2Yw2QMmYoNKHgrD', 'Develop upper-body pushing strength and improve overall pressing mechanics.'),
  (2, 'Incline Dumbbell Bench Press', 'Strength - Chest', NULL, 'Increase upper-chest strength and muscle development. Keep your shoulder blades supported against the bench. Lower the dumbbells under control. Press upward while maintaining a stable shoulder position. Avoid excessively arching the lower back.'),
  (3, 'Incline Dumbbell Chest Press', 'Strength - Chest', 'https://youtu.be/6tW4LUaOxlE?si=NbISKHArp1BBY38t', 'Maintain chest and pressing strength in a supported position. Keep the upper back comfortably supported. Lower the dumbbells slowly. Exhale as you press upward. Avoid excessive lower-back arching. Maintain comfortable abdominal pressure throughout.'),
  (4, 'Standing Cable Chest Fly', 'Strength - Chest', 'https://youtube.com/shorts/FkEwrtyb4sc?si=kkNhTqbXVxTHkpl_', 'Strengthen the chest while maintaining upright trunk control. Use a comfortable and stable stance. Maintain a slight bend in the elbows. Bring the hands together smoothly. Exhale during the effort. Avoid excessive trunk movement.'),
  (5, 'Chest Press Machine', 'Strength - Chest', 'https://youtu.be/ai4EuMwfhho?si=E1CY86ZDiYP9NwRH', 'Improve upper-body pushing strength using a stable and supported position. Keep your back comfortably supported. Keep the shoulders relaxed and away from the ears. Press forward smoothly without locking the elbows. Return the handles slowly and under control.'),
  (6, 'Lat Pulldown', 'Strength - Back', 'https://youtu.be/JGeRYIZdojU?si=rY2pvghccCtmq6-q', 'Strengthen the latissimus dorsi and improve scapular control. Pull with the elbows rather than the hands. Keep your chest lifted. Avoid shrugging the shoulders.'),
  (7, 'Seated Cable Row', 'Strength - Back', 'https://youtu.be/lJoozxC0Rns?si=7mkY-1SDR1lCvr5v', 'Improve posture and upper-back strength. Initiate by pulling the shoulder blades back. Keep the chest tall. Return slowly.'),
  (8, 'Barbell Row', 'Strength - Back', NULL, 'Strengthen the upper back and improve pulling strength and scapular control. Hinge from the hips while maintaining a neutral spine. Pull the bar toward your torso. Drive the elbows backward. Lower the bar slowly and under control.'),
  (9, 'Lat Pulldown with Thoracic Rotation', 'Strength - Back', 'https://youtube.com/shorts/i98CD_LVYj4?si=l4a-Bri9yWoXqQ6Y', 'Strengthen the latissimus dorsi and improve scapular control. Pull with the elbows rather than the hands. Keep your chest lifted. Avoid shrugging the shoulders.'),
  (10, 'Cable Reverse Fly', 'Strength - Back', 'https://youtu.be/qDnwFycUW0I?si=C8G9FpBszW7g3KaF', 'Strengthen the rhomboids, posterior shoulders, and scapular stabilizers. Keep the chest tall. Pull the arms outward under control. Gently draw the shoulder blades toward each other. Avoid shrugging. Return slowly.'),
  (11, 'Single-Arm Landmine Press', 'Strength - Shoulders', 'https://youtu.be/hhQdExaLUuU?si=jgqawji8m9cnFrqe', 'Improve unilateral shoulder strength, scapular control, and core stability. Press slightly upward and forward. Keep the ribs down. Avoid leaning to one side.'),
  (12, 'Face Pull', 'Strength - Shoulders', 'https://youtu.be/0Po47vvj9g4?si=Yv8IeCtC7f7HIE4L', 'Strengthen the posterior shoulder, rotator cuff, and lower trapezius. Pull toward eye level. Rotate the hands outward at the finish. Keep the neck relaxed.'),
  (13, 'Cable Lateral Raise', 'Strength - Shoulders', NULL, 'Strengthen the lateral deltoid and improve shoulder control. Keep the shoulder relaxed. Raise the arm smoothly to approximately shoulder height. Avoid using momentum or leaning excessively. Lower the weight slowly.'),
  (14, 'Dumbbell Lateral Raise', 'Strength - Shoulders', NULL, 'Maintain shoulder strength and controlled arm movement. Keep the shoulders relaxed. Raise the dumbbells smoothly to a comfortable height. Avoid shrugging or using momentum. Lower slowly.'),
  (15, 'Standing Dumbbell Shoulder Press', 'Strength - Shoulders', 'https://youtu.be/e_f5oodNEcI?si=f9NXTRTt_NBDcriR', 'Maintain shoulder strength and controlled overhead movement. Use a stable and comfortable stance. Begin with the dumbbells around shoulder height. Exhale as you press upward. Avoid excessive lumbar extension. Maintain normal breathing and abdominal control.'),
  (16, 'Mini Band External Rotation', 'Strength - Shoulders', NULL, 'Strengthen the rotator cuff and improve shoulder stability. Keep the elbow close to the side of the body. Maintain approximately a 90° bend at the elbow. Rotate the forearm outward against the resistance band. Keep the shoulder relaxed and avoid rotating the torso. Return slowly under control.'),
  (17, 'Wall Slide with Lower-Trap Focus', 'Strength - Shoulders', 'https://youtu.be/2enCPQnaAcQ?si=DdYgzCxKoryJbguj', 'Improve scapular upward rotation and lower-trapezius activation. Maintain comfortable contact with the wall. Slide the arms upward slowly. Keep the shoulders away from the ears. Focus on smooth scapular movement. Return under control.'),
  (18, 'Barbell Back Squat', 'Strength - Legs', 'https://youtu.be/-bJIpOq-LWk?si=AXif05BXhDZU7Fmm', 'Build lower-body strength while maintaining pelvic and trunk stability. Keep your chest tall. Maintain a neutral spine. Drive evenly through both feet.'),
  (19, 'Barbell Deadlift', 'Strength - Legs', 'https://youtu.be/7j-2w4-P14I?si=b9KB8zOlLffueSys', 'Strengthen the posterior chain and improve hip hinge mechanics. Hinge from the hips first. Keep the bar close to your body. Brace your core throughout the movement.'),
  (20, 'Hip Thrust', 'Strength - Legs', 'https://youtu.be/29OfN4ztW_g?si=QSDa3I5U36ksaP1A', 'Maximize glute strength while minimizing unnecessary spinal loading. Tuck the pelvis slightly at the top. Avoid excessive lower-back extension.'),
  (21, 'Hip Abduction Machine', 'Strength - Legs', 'https://youtu.be/e9AqTFMmP18?si=nvKYTVwHsPS028Ld', 'Strengthen the gluteus medius and improve hip and pelvic stability. Sit tall with your back supported. Push your knees outward in a slow and controlled manner. Pause briefly at the end range. Return slowly without letting the weight drop.'),
  (22, 'Hip Adduction Machine', 'Strength - Legs', NULL, 'Strengthen the adductor muscles and improve lower-body stability. Sit upright with your back supported. Bring your legs together in a slow and controlled motion. Return slowly while maintaining control.'),
  (23, 'Leg Extension', 'Strength - Legs', 'https://youtu.be/4ZDm5EbiFI8?si=6zuC2xyhfoVNdwcU', 'Strengthen the quadriceps with controlled knee extension. Move through a comfortable range. Pause briefly at the top. Lower the weight slowly.'),
  (24, 'Leg Curl', 'Strength - Legs', 'https://youtu.be/MAbThtU8Sis?si=ucH7B_D4fxBnjeak', 'Strengthen the hamstrings and improve posterior knee stability. Keep the hips stable. Control both the lifting and lowering phases. Avoid using momentum.'),
  (25, 'Dumbbell Split Squat', 'Strength - Legs', NULL, 'Improve unilateral leg strength, hip stability, and lower-body control. Maintain a stable split stance. Lower your body vertically with control. Keep the front knee aligned with the foot. Drive through the front foot to return upward.'),
  (26, 'Seated Calf Raise Machine', 'Strength - Legs', NULL, 'Strengthen the calf muscles and improve ankle strength and control. Move through a comfortable full range of motion. Rise onto the toes under control. Pause briefly at the top. Lower slowly before beginning the next repetition.'),
  (27, 'Dumbbell Hip Thrust on Bench', 'Strength - Legs', 'https://youtu.be/YoMsXly303Q?si=3uzqTPlQJ_hdsuUE', 'Maintain glute strength, hip-extension capacity, and pelvic control. Support the upper back comfortably against the bench. Keep both feet firmly planted. Drive evenly through both feet. Exhale as the hips rise. Finish with the glutes rather than excessively extending the lower back.'),
  (28, 'Wall-Supported Mini Squat with Yoga Block Adductor Squeeze', 'Strength - Legs', 'https://youtube.com/shorts/HL8XADJE0HE?si=d1c46BD4ho7m2ZFe', 'Improve controlled adductor activation and lower-body control. Place a yoga block between the knees. Use the wall for support. Lower into a comfortable mini-squat. Gently squeeze the yoga block. Maintain normal breathing.'),
  (29, 'Sit-to-Stand from Chair or Bench', 'Strength - Legs', 'https://youtu.be/ITv-_BkcrD0?si=mXXWhj58TPbkQ49B', 'Maintain functional leg strength and improve the ability to stand up safely. Start from a stable chair or bench. Lean slightly forward and push through both feet to stand. Sit back down slowly and under control. Use hand support if needed.'),
  (30, 'Turkish Get-Up', 'Full Body Strength', 'https://youtu.be/-QEE1Q4iW-w?si=Eqh-9eIrEqrsp_IT', 'Improve full-body stability, shoulder control, and core strength. Keep your eyes on the weight. Move slowly through each position. Maintain shoulder stability throughout.'),
  (31, 'Dumbbell Squat to Press', 'Full Body Strength', NULL, 'Maintain coordinated lower- and upper-body strength. Squat through a comfortable range. Drive evenly through both feet as you stand. Press the dumbbells overhead under control. Exhale during the squat-to-press transition. Avoid breath holding or abdominal coning.'),
  (32, 'Dumbbell Deadlift to Row', 'Full Body Strength', NULL, 'Combine hip-hinge control with upper-back strength. Hinge through the hips while maintaining trunk control. Keep the dumbbells close to the body. Perform the row without rotating the torso. Lower the dumbbells slowly. Return to standing under control.'),
  (33, 'Incline Plyometric Push-Up', 'Plyometrics - Upper Body', 'https://youtu.be/OFchDk0Vpbg?si=tzwjSDyMqckYnlSC', 'Improve upper-body power and explosive pushing strength. Push explosively away from the bench. Land softly and under control.'),
  (34, 'Explosive One-Arm Cable Row', 'Plyometrics - Upper Body', 'https://youtu.be/OrAcowGGU2U?si=U8fB8d6K0jjrLrxZ', 'Improve explosive pulling strength and unilateral scapular control. Pull explosively with one arm. Return slowly and under control.'),
  (35, 'Plyometric Biceps Curl', 'Plyometrics - Upper Body', 'https://youtu.be/wJUZ5JRdBxs?si=rxWAXijCIgExRQnj', 'Improve explosive pulling power and biceps control. Curl explosively. Control the lowering phase.'),
  (36, 'Shoulder External Rotator Plyometric Deceleration', 'Plyometrics - Upper Body', 'https://youtu.be/ElhiHqG9Pq0?si=YkLJDaxkDl_JXpcy', 'Improve rotator cuff reactive strength, shoulder stability, and deceleration control. Keep the elbow stable. Move quickly during the reactive phase. Control the return/deceleration. Do not force the shoulder into excessive rotation.'),
  (37, 'Plyometric One-Arm Push-Up', 'Plyometrics - Upper Body', 'https://youtu.be/F-K4krjEJcw?si=ZwEUUlZKVFYqSbhM', 'Improve unilateral explosive pushing power and landing control. Push explosively. Land softly and regain control before the next rep. Keep the shoulder and trunk stable.'),
  (38, 'Plyometric Landmine Press', 'Plyometrics - Upper Body', 'https://youtu.be/r4khxxIg96Q?si=vd_0X6NpbuJWJJmy', 'Improve explosive pressing power and shoulder stability. Drive the bar explosively upward and forward. Control the catch/return. Keep the core engaged and avoid excessive trunk rotation.'),
  (39, 'Medicine Ball Overhead Throw', 'Plyometrics - Upper Body', NULL, 'Develop explosive upper-body power and improve force production through the shoulders and trunk. Start with the medicine ball in front of your body. Drive the ball explosively overhead. Use your whole body to generate power. Reset your position before each repetition.'),
  (40, 'Rotational Medicine Ball Throw', 'Plyometrics - Upper Body', NULL, 'Improve rotational power, trunk coordination, and explosive force production. Start with the ball beside your body. Rotate through the hips and torso. Throw the ball explosively. Maintain control when returning to the starting position.'),
  (41, 'Alternating Plyometric Landmine Press', 'Plyometrics - Upper Body', NULL, 'Improve explosive pressing strength, shoulder stability, and coordination. Start in a stable athletic position. Press the bar explosively upward and forward. Switch hands smoothly between repetitions. Keep your core engaged and avoid excessive trunk rotation.'),
  (42, 'Plyometric Deadlift', 'Plyometrics - Lower Body', 'https://youtu.be/Fq0cER1PVDY?si=M3-i01D-EmpxCm7X', 'Improve explosive hip power and posterior-chain control. Drive explosively through the hips. Land softly and maintain good alignment.'),
  (43, 'Plyometric Squat', 'Plyometrics - Lower Body', 'https://youtu.be/rdp7ng9Z2l8?si=2tTe0Aq30vk-QqzP', 'Improve lower-body power and landing control. Jump explosively from the squat. Land softly with knees aligned. Control each landing before the next rep.'),
  (44, 'Diagonal Bounds', 'Plyometrics - Lower Body', 'https://youtu.be/8cmo5xShvqs?si=tXfJtGgkSKEPYLdc', 'Improve multidirectional power and single-leg landing control. Jump diagonally from one leg to the other. Land softly and stabilize before the next jump.'),
  (45, 'Medicine Ball Squat to Overhead Slam', 'Plyometrics - Lower Body', NULL, 'Develop explosive lower-body power and improve whole-body coordination. Hold the medicine ball in front of your body. Lower into a controlled squat. Drive explosively upward while bringing the ball overhead. Slam the ball forcefully toward the floor. Reset your position before the next repetition.'),
  (46, 'Jump Rope', 'Plyometrics - Lower Body', NULL, 'Improve lower-body reactivity, coordination, and conditioning. Stay light on the feet and keep jumps quick and controlled.'),
  (47, 'Cable Pallof Press', 'Core & Stability', 'https://youtu.be/-0N2xTi69t8?si=RykQsqdEUT3EBpLS', 'Improve core stability and resist unwanted trunk rotation. Keep ribs stacked over the pelvis. Exhale as you press forward. Do not allow your torso to rotate.'),
  (48, 'Bottom-Up Kettlebell Carry', 'Core & Stability', 'https://youtu.be/9xUakWLqQkE?si=iQdzRPd-00oTMioW', 'Improve shoulder stability, grip strength, and core control. Keep the kettlebell perfectly vertical. Maintain an upright posture. Walk slowly with controlled breathing.'),
  (49, 'Modified Side Plank with Pelvic Rotation', 'Core & Stability', 'https://www.youtube.com/watch?v=DXQ9YKHtcsk', NULL),
  (50, 'Copenhagen Plank', 'Core & Stability', 'https://youtu.be/omcxYSiUg5M?si=ewP6ZvXB3XxOqwbQ', 'Improve adductor strength and pelvic stability. Keep the body in a straight line. Keep the hips elevated throughout.'),
  (51, 'Side Plank with Hip Abduction', 'Core & Stability', 'https://youtu.be/GtnSaENGhBw?si=B405ewCA8O9Gl5q4', 'Improve gluteus medius strength, lateral hip stability, and core control. Maintain the side-plank position. Lift the top leg against the band. Keep the pelvis stable.'),
  (52, 'Bear Hold', 'Core & Stability', NULL, NULL),
  (53, '360° Diaphragmatic Breathing with Pelvic Floor Coordination', 'Core & Stability', 'https://youtube.com/shorts/WEHWDrMYbc0?si=pOpcBCi46nJI4xAg', 'Improve breathing mechanics and coordination between the diaphragm, deep core, and pelvic floor. Inhale slowly and allow the rib cage and abdomen to expand naturally. Allow the pelvic floor to relax during the inhale. Exhale slowly while gently engaging the deep abdominal muscles. Coordinate the exhale with a gentle pelvic-floor contraction.'),
  (54, 'Pallof Press to Overhead', 'Core & Stability', 'https://youtube.com/shorts/XFuO9Fvpz0Q?si=w8RLSK014XGHS7b-', 'Improve anti-rotational deep-core and trunk stability. Stand in a stable and comfortable position. Hold the cable or resistance band at chest level. Exhale as you press the hands forward. Resist the rotational pull without allowing the torso to turn. Return slowly under control.'),
  (55, 'Wall-Supported Side Plank Hold', 'Core & Stability', 'https://youtube.com/shorts/_VYXA9xO4PE?si=J672gMy8scfHyjKT', NULL),
  (56, 'Side Plank on Knees', 'Core & Stability', NULL, NULL),
  (57, 'Static Beast', 'Animal Flow', 'https://youtu.be/qy3OOJfYGxA?si=b-l0tAuJ5oYeHx60', NULL),
  (58, 'Loaded Beast', 'Animal Flow', 'https://youtu.be/wCWspd4ThkE?si=SWObnoX3X_38TG8R', NULL),
  (59, 'Beast Reach', 'Animal Flow', 'https://youtu.be/jdrCuzQZjPc?si=B2x6S0cyRZugx7Nl', NULL),
  (60, 'Forward & Reverse Traveling Ape', 'Animal Flow', 'https://youtu.be/IxyeJvIvSIg?si=FMKhaeNF7XzZMBBJ', NULL),
  (61, 'Reverse Traveling Crab', 'Animal Flow', 'https://youtu.be/iuP_rJxk7VA?feature=shared', NULL),
  (62, 'Ape Reach', 'Animal Flow', 'https://youtu.be/KzaV7Mmt2KU?si=ef6XvPt4Tcr8cAxc', NULL),
  (63, 'Side Kickthrough into Full Scorpion', 'Animal Flow', 'https://youtu.be/1nmNI4lOoQ0?si=Sp9mI1UA9uieWPTq', NULL),
  (64, 'Cat-Cow', 'Warm-Up & Mobility', 'https://www.youtube.com/watch?v=LIVJZZyZ2qM', NULL),
  (65, 'Thoracic Rotation (Quadruped)', 'Warm-Up & Mobility', 'https://www.youtube.com/watch?v=-7rtg9INTe8', NULL),
  (66, 'Quadruped Hip CARs', 'Warm-Up & Mobility', 'https://www.youtube.com/watch?v=bUHGwjpGyYg', NULL),
  (67, 'Supine Hamstring Knee Extension', 'Warm-Up & Mobility', 'https://www.youtube.com/watch?v=fjuENcsk6dY', NULL),
  (68, '90/90 Hip Switch', 'Warm-Up & Mobility', 'https://www.youtube.com/watch?v=m51AZSXMvEA', NULL),
  (69, 'Open Book Thoracic Rotation', 'Warm-Up & Mobility', 'https://youtube.com/shorts/SKapoHxQxuk?si=PTjFhrWmZyHKw3lE', NULL),
  (70, 'Foam Roller Thoracic Extension', 'Warm-Up & Mobility', 'https://youtube.com/shorts/uWIJ3TJJwbQ?si=QQxYQ0bduUFMrhM3', 'Improve thoracic extension and reduce stiffness through the upper back. Position the foam roller across the mid-to-upper back. Support the head and neck. Gently extend over the roller while exhaling. Keep the movement focused through the thoracic spine. Avoid excessive lower-back extension.'),
  (71, 'Foam Roller Thoracic Rotation', 'Warm-Up & Mobility', 'https://youtube.com/shorts/mDfgFJDJcRw?si=5_o-yQjti4JyG7aQ', 'Improve thoracic rotation and rib-cage mobility. Use the foam roller for support. Rotate slowly through the upper back. Follow the movement with your eyes. Exhale gently as you rotate. Avoid forcing the end range.'),
  (72, 'Posterior Shoulder Foam Roll + Thoracic Rotation', 'Warm-Up & Mobility', 'https://youtube.com/shorts/xCyjxI-IjCs?si=EgCLK_Oi1H32Wnao', 'Reduce posterior shoulder and upper-back stiffness before reinforcing the available range with active rotation. Gently roll the posterior shoulder and upper-back area. Avoid direct pressure over painful or sensitive areas. Follow the rolling with controlled thoracic rotations. Maintain relaxed breathing.'),
  (73, 'Foam Roller Child’s Pose Reach', 'Warm-Up & Mobility', 'https://youtu.be/WITPjXi48r4?si=r5mjBxZ7SosEiTSr', 'Improve thoracic and lat mobility while encouraging posterior and lateral rib-cage expansion. Begin in a comfortable wide-knee position. Place your hands or forearms on the foam roller. Slowly roll forward while allowing the chest to lower comfortably. Take a slow breath into the back and sides of the rib cage.'),
  (74, 'Side-Lying Hip Internal Rotation with Block Squeeze', 'Warm-Up & Mobility', 'https://youtube.com/shorts/79OfOp6RvLM?si=z1_mOpy8LCo_wyny', 'Improve active hip internal rotation and controlled hip movement. Lie comfortably on your side. Maintain gentle pressure on the yoga block as instructed. Move slowly into hip internal rotation. Keep the pelvis controlled. Work only within a comfortable range.'),
  (75, 'Ankle Circles', 'Warm-Up & Mobility', NULL, NULL),
  (76, 'Spanish Squat', 'Corrective Exercises', 'https://youtu.be/SZMidXQy7jY?si=AvE6cwNYlOVQie-6', 'Strengthen the quadriceps and improve knee control. Keep constant tension on the band. Sit back while keeping the torso upright. Control both directions.'),
  (77, 'Kettlebell Tibialis Raise', 'Corrective Exercises', NULL, 'Strengthen the tibialis anterior and improve ankle control. Keep the heels supported. Lift the toes toward you. Lower slowly with control.'),
  (78, 'Radial Nerve Glide', 'Corrective Exercises', 'https://youtu.be/vL7yF9TXCCo?si=rWRLGiilnVN19rED', NULL),
  (79, 'Resistance Band Terminal Knee Extension', 'Corrective Exercises', 'https://youtube.com/shorts/CC6DhLFD_00?si=xBtOg-j9gxhUl3WG', 'Improve quadriceps activation and knee control. Anchor the band behind the knee. Begin with a slight bend in the knee. Extend the knee against the resistance. Briefly contract the quadriceps. Return slowly.'),
  (80, 'Single-Leg Hip Airplane with Foam Roller Support - Hip Internal / External Rotation', 'Corrective Exercises', 'https://youtube.com/shorts/Ju8uXgv8zng?si=Hpbi6exu_GJ5o1hD', 'Improve hip rotational mobility and controlled movement through internal and external rotation. Use the foam roller for support. Move slowly between internal and external rotation. Keep the movement controlled rather than forcing the range. Avoid compensating through the lower back.'),
  (81, 'Split-Stance Forward-Backward Weight Shift', 'Corrective Exercises', 'https://youtu.be/RBhXKn2a3TU?si=FLkFvh12Qzp83MBK', 'Improve controlled weight transfer, foot loading, and big-toe contact. Begin in a comfortable split stance. Slowly transfer the body weight toward the front leg. Maintain contact through the heel, base of the little toe, and base of the big toe. Shift the weight back toward the rear leg under control. Avoid collapsing the medial arch.'),
  (82, 'Tibial Nerve Glide / Flossing', 'Corrective Exercises', 'https://youtube.com/shorts/1b5KsqbruGI?si=dm6tIE8cUPvsSmx2', 'Maintain comfortable neural mobility through the posterior lower leg. Perform the movement slowly and rhythmically. Move into and out of the position rather than holding the end range. The movement should remain comfortable. Avoid forcing a strong neural stretch. Stop if neurological symptoms increase.'),
  (83, 'Mini-Band Clamshell', 'Corrective Exercises', NULL, 'Strengthen the lateral hip muscles and improve hip and pelvic control. Keep the pelvis stacked. Open the upper knee against the band. Avoid rolling the trunk backward. Return slowly under control.'),
  (84, 'Seated Knee Extension', 'Corrective Exercises', 'https://youtu.be/VuJZ6dqMf8M?si=qJAhM0Bryg_YjPtY', 'Warm up the knees and activate the quadriceps. Extend one knee at a time through a comfortable range. Return slowly without swinging the leg.'),
  (85, 'Supported Heel Raise', 'Corrective Exercises', 'https://youtu.be/J3qQrxPEhHA?si=uHc8QFFw98cYUDUm', 'Warm up the calves and ankles. Use a stable support. Rise onto the toes slowly and lower with control.'),
  (86, 'Rings L-Sit', 'Rings / Gymnastics', 'https://youtu.be/lwcHmXvw-T4?si=j5m3GM0z_rdTinHB', 'Improve core, shoulder, and ring stability. Push firmly down into the rings. Keep the shoulders away from the ears. Keep the legs elevated as much as possible.'),
  (87, 'Rings Candle', 'Rings / Gymnastics', 'https://youtu.be/JYQcvBR11L8?si=O95TC1cHvlUPoA_3', 'Improve core control and body awareness on the rings. Keep the rings stable. Lift the hips under control. Avoid swinging through the movement.'),
  (88, 'Rings Skin the Cat', 'Rings / Gymnastics', 'https://youtu.be/ABSpTs17ObA?si=Wj5NQIzgpbWTY3ZS', 'Improve shoulder mobility, ring control, and full-body coordination. Perform slowly and under control. Use low rings initially. If the full version feels uncomfortable or unsafe, use the easier regression.'),
  (89, 'Low Rings Skin the Cat', 'Rings / Gymnastics', 'https://youtu.be/xdAyvQOB1Es?si=DfIwGb34437d39O-', 'Easier low-ring regression for Rings Skin the Cat, listed in the source PDF when the full version feels uncomfortable or unsafe.'),
  (90, 'Child’s Pose', 'Stretching & Recovery', 'https://youtu.be/kH12QrSGedM?si=uiWg64FsKiIEo3JJ', 'Gently stretch the back, shoulders, and hips. Widen your knees if needed to make room for your abdomen. Reach your arms forward and breathe deeply.'),
  (91, 'Thoracic Open Book Stretch', 'Stretching & Recovery', 'https://youtu.be/YMswmjk7Qj4?si=yeFlNb7pRhdexZ7X', 'Improve thoracic spine mobility and reduce upper-back stiffness. Keep your knees together. Rotate only through the upper back. 6 repetitions each side'),
  (92, 'Hip Flexor Stretch', 'Stretching & Recovery', 'https://youtu.be/tsGPYSQbZx4?si=HgBzu__qAKlwMhnM', 'Reduce tension in the front of the hips and improve pelvic posture. Use a half-kneeling position with support if needed. Keep the pelvis neutral.'),
  (93, 'Supported Child’s Pose', 'Stretching & Recovery', 'https://youtu.be/4YQ3vsL3ja4?si=wFxFo6Zrx_3cA2gd', 'Relax the back, hips, and torso. Use a comfortable wide-knee position to allow space for the abdomen. Relax forward only as far as comfortable. Focus on slow, relaxed breathing.'),
  (94, 'Adductor Rock Back', 'Stretching & Recovery', 'https://youtube.com/shorts/j-2XIN8Yims?si=le4Mb5iVJQ07ZZUz', 'Improve adductor and hip mobility through a gentle, controlled movement. Begin on your hands and knees. Extend one leg comfortably out to the side. Keep the foot supported in a comfortable position. Slowly shift the hips backward until you feel a gentle stretch through the inner thigh. Return forward under control.'),
  (95, 'Frog Rock Back with Hip Rotation', 'Stretching & Recovery', 'https://youtube.com/shorts/6GuP_grwurk?si=hHNmreB50ZlrOFML', 'Explore comfortable hip mobility through a controlled range. Begin in a comfortable supported frog position. Rock backward slowly. Add gentle hip rotation only within a pain-free range. Avoid forcing internal or external rotation.'),
  (96, 'Supported Pigeon Stretch', 'Stretching & Recovery', 'https://youtu.be/fbvZ0Eg-qaE?si=IsSGHkkS_Tm1UY23', 'Gently mobilize the posterior hip. Use yoga blocks or another support if needed. Keep the position comfortable. Avoid forcing hip range. Stop if pelvic or groin symptoms increase.'),
  (97, 'Seated QL / Lateral Trunk Stretch', 'Stretching & Recovery', 'https://youtube.com/shorts/OfOfkY09vBo?si=EMw2VL1qFQicwZhV', 'Gently reduce stiffness through the lateral trunk and rib-cage region. Sit comfortably. Reach one arm overhead. Gently lean toward the opposite side. Breathe slowly into the side of the rib cage. Avoid forcing the stretch.'),
  (98, 'Dynamic Frog Stretch', 'Stretching & Recovery', 'https://youtube.com/shorts/wH04F8_giBw?si=ZdhU2MlufVxMpjf_', 'Gently mobilize the inner-thigh and hip region. Use a comfortable range. Do not force the knees wider. Maintain relaxed breathing. Skip this exercise if it increases groin or pelvic pain.'),
  (99, 'Relaxation Breathing / Meditation', 'Stretching & Recovery', NULL, 'Finish in a comfortable position and focus on slow, relaxed breathing. Inhale through the nose, allow the rib cage to expand naturally, then exhale slowly and relax the shoulders and body.'),
  (100, 'Easy Walking', 'Conditioning', NULL, 'Gradually prepare the body for exercise and increase circulation. Walk at a comfortable pace and keep your posture relaxed and upright.'),
  (101, 'Seated Marching', 'Conditioning', 'https://youtu.be/uoRVJBDEX60?si=XBDo8vAU1LYNELKM', 'Warm up the hips and legs while maintaining a supported position. Sit tall with your feet on the floor. Lift one knee at a time in a slow and controlled rhythm.'),
  (102, 'Shoulder Rolls', 'Conditioning', 'https://youtu.be/X7NtgY9kCCM?si=DVbz612m0x3k3PEl', 'Gently warm up the shoulders and upper back. Move the shoulders slowly backward and forward. Keep the neck relaxed.'),
  (103, 'Light Boxing', 'Conditioning', NULL, 'Maintain cardiovascular conditioning, coordination, and enjoyment through a familiar activity. Keep the movements smooth, maintain steady breathing, and rest whenever needed.'),
  (104, 'Sit-to-Stand + Boxing Circuit', 'Conditioning', NULL, 'Perform 5 controlled sit-to-stands, then complete 30 seconds of light boxing. Rest before beginning the next round.'),
  (105, '45-Minute Walk', 'Conditioning', NULL, 'Maintain cardiovascular fitness, promote active recovery, and support overall endurance. Maintain a comfortable sustainable pace with relaxed breathing.')
),
category_names as materialized (
  select distinct category as name from source
),
matched_categories as materialized (
  select n.name, chosen.id as existing_id,
    (select count(*) from public.exercise_categories c
      where lower(btrim(c.name)) = lower(btrim(n.name))) as existing_name_matches
  from category_names n
  left join lateral (
    select c.id from public.exercise_categories c
    where lower(btrim(c.name)) = lower(btrim(n.name))
    order by c.id limit 1
  ) chosen on true
),
inserted_categories as (
  insert into public.exercise_categories (name, is_default)
  select name, false from matched_categories where existing_id is null
  order by name
  returning id, name
),
resolved_categories as materialized (
  select m.name, coalesce(m.existing_id, i.id) as id,
    case when m.existing_id is null then 'inserted' else 'reused' end as action,
    m.existing_name_matches
  from matched_categories m
  left join inserted_categories i on lower(btrim(i.name)) = lower(btrim(m.name))
),
matched_exercises as materialized (
  select s.*, chosen.id as existing_id,
    chosen.youtube_url as current_video,
    chosen.default_instructions as current_instructions,
    (select count(*) from public.exercise_library e
      where lower(btrim(e.name)) = lower(btrim(s.name))) as existing_name_matches
  from source s
  left join lateral (
    select e.id, e.youtube_url, e.default_instructions
    from public.exercise_library e
    where lower(btrim(e.name)) = lower(btrim(s.name))
    order by e.id limit 1
  ) chosen on true
),
inserted_exercises as (
  insert into public.exercise_library (name, youtube_url, default_instructions)
  select name, youtube_url, default_instructions
  from matched_exercises where existing_id is null
  order by pdf_number
  returning id, name, youtube_url, default_instructions
),
updated_exercises as (
  update public.exercise_library e
  set youtube_url = case
        when (e.youtube_url is null or e.youtube_url ~ '^[[:space:]]*$')
          and m.youtube_url is not null then m.youtube_url else e.youtube_url end,
      default_instructions = case
        when (e.default_instructions is null or e.default_instructions ~ '^[[:space:]]*$')
          and m.default_instructions is not null then m.default_instructions
        else e.default_instructions end
  from matched_exercises m
  where e.id = m.existing_id and (
    ((e.youtube_url is null or e.youtube_url ~ '^[[:space:]]*$') and m.youtube_url is not null)
    or ((e.default_instructions is null or e.default_instructions ~ '^[[:space:]]*$')
      and m.default_instructions is not null)
  )
  returning e.id, e.youtube_url, e.default_instructions
),
resolved_exercises as materialized (
  select m.pdf_number, m.name, m.category,
    coalesce(m.existing_id, i.id) as id,
    case when i.id is not null then 'inserted'
      when u.id is not null then 'updated' else 'unchanged' end as action,
    m.existing_name_matches,
    case when i.id is not null then i.youtube_url
      when u.id is not null then u.youtube_url else m.current_video end as youtube_url,
    case when i.id is not null then i.default_instructions
      when u.id is not null then u.default_instructions
      else m.current_instructions end as default_instructions,
    (u.id is not null and m.youtube_url is not null
      and (m.current_video is null or m.current_video ~ '^[[:space:]]*$')) as video_filled,
    (u.id is not null and m.default_instructions is not null
      and (m.current_instructions is null or m.current_instructions ~ '^[[:space:]]*$')) as instructions_filled
  from matched_exercises m
  left join inserted_exercises i on lower(btrim(i.name)) = lower(btrim(m.name))
  left join updated_exercises u on u.id = m.existing_id
),
inserted_mappings as (
  insert into public.exercise_category_map (exercise_id, category_id)
  select e.id, c.id from resolved_exercises e
  join resolved_categories c on c.name = e.category
  where not exists (
    select 1 from public.exercise_category_map m
    where m.exercise_id = e.id and m.category_id = c.id
  )
  returning exercise_id, category_id
)
select
  jsonb_build_object(
    'source_exercises', (select count(*) from source),
    'source_categories', (select count(*) from category_names),
    'exercises_inserted', (select count(*) from inserted_exercises),
    'exercises_updated', (select count(*) from updated_exercises),
    'exercises_unchanged', (select count(*) from resolved_exercises where action = 'unchanged'),
    'categories_inserted', (select count(*) from inserted_categories),
    'categories_reused', (select count(*) from matched_categories where existing_id is not null),
    'mappings_inserted', (select count(*) from inserted_mappings),
    'payload_without_video', (select count(*) from source where youtube_url is null),
    'payload_without_instructions', (select count(*) from source where default_instructions is null),
    'imported_exercises_without_video', (select count(*) from resolved_exercises
      where youtube_url is null or youtube_url ~ '^[[:space:]]*$'),
    'imported_exercises_without_instructions', (select count(*) from resolved_exercises
      where default_instructions is null or default_instructions ~ '^[[:space:]]*$')
  ) as totals,
  (select jsonb_agg(jsonb_build_object(
      'pdf_number', e.pdf_number, 'name', e.name, 'id', e.id, 'action', e.action,
      'video_filled', e.video_filled, 'instructions_filled', e.instructions_filled,
      'existing_name_matches', e.existing_name_matches
    ) order by e.pdf_number) from resolved_exercises e) as exercise_actions,
  (select jsonb_agg(jsonb_build_object(
      'name', c.name, 'id', c.id, 'action', c.action,
      'existing_name_matches', c.existing_name_matches
    ) order by c.name) from resolved_categories c) as category_actions,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'pdf_number', e.pdf_number, 'name', e.name,
      'needs_video', (e.youtube_url is null or e.youtube_url ~ '^[[:space:]]*$'),
      'needs_instructions', (e.default_instructions is null or e.default_instructions ~ '^[[:space:]]*$'),
      'duplicate_existing_names', e.existing_name_matches > 1
    ) order by e.pdf_number), '[]'::jsonb)
   from resolved_exercises e
   where e.youtube_url is null or e.youtube_url ~ '^[[:space:]]*$'
      or e.default_instructions is null or e.default_instructions ~ '^[[:space:]]*$'
      or e.existing_name_matches > 1) as remaining_attention;

commit;
