-- স্লাইডারে এখন আর কোনো লেখা দেখানো হয় না (শুধু ছবি + ঐচ্ছিক লিংক), তাই
-- স্লাইডের শিরোনাম, সাব-টাইটেল ও বাটন-লেখার কলাম মুছে ফেলা হলো। বিদ্যমান
-- লেখাগুলোও এর সাথে মুছে যাবে - এগুলো কোথাও ব্যবহৃত হয় না। button_link থাকছে।
ALTER TABLE "website_slides" DROP COLUMN "title",
DROP COLUMN "subtitle",
DROP COLUMN "button_text";
