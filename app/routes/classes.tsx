import { Link } from "@remix-run/react";

export default function ClassesPage() {
  return (
    <div className="bg-green-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Karate Classes for Children
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            Discover the art of the &ldquo;empty hand&rdquo; with Sensei Negin
          </p>
        </div>

        <div className="mt-12 bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="p-8">
            <h2 className="text-2xl font-bold text-green-600 mb-6">Class Schedule</h2>
            <div className="bg-green-50 p-6 rounded-lg mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Children&apos;s Classes (Ages 6-12)</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-green-600 font-bold mr-3">Monday:</span>
                  <span>6:00 PM - 7:00 PM at Lighthouse Christian Academy</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 font-bold mr-3">Wednesday:</span>
                  <span>6:00 PM - 7:00 PM at Lighthouse Christian Academy</span>
                </li>
              </ul>
            </div>

            <h2 className="text-2xl font-bold text-green-600 mb-6">What to Expect</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Class Structure</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li>Warm-up exercises and stretching</li>
                  <li>Basic techniques (kihon) practice</li>
                  <li>Forms (kata) training</li>
                  <li>Partner drills and applications</li>
                  <li>Games and activities to reinforce skills</li>
                  <li>Cool-down and meditation</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">What to Bring</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li>Comfortable workout clothes (karate gi not required for beginners)</li>
                  <li>Water bottle</li>
                  <li>Positive attitude and willingness to learn</li>
                  <li>Completed waiver form (for first-time students)</li>
                </ul>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-green-600 mb-6">Belt Progression</h2>
            <p className="text-gray-600 mb-6">
              Students progress through a traditional belt system that recognizes their growing skills and knowledge.
              Regular testing opportunities allow students to demonstrate their abilities and advance to the next level.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-4 mb-8">
              <div className="bg-white p-3 text-center border rounded-md">
                <div className="h-4 bg-white border border-gray-200 rounded mb-2"></div>
                <span className="text-sm">White</span>
              </div>
              <div className="bg-white p-3 text-center border rounded-md">
                <div className="h-4 bg-yellow-200 rounded mb-2"></div>
                <span className="text-sm">Yellow</span>
              </div>
              <div className="bg-white p-3 text-center border rounded-md">
                <div className="h-4 bg-orange-300 rounded mb-2"></div>
                <span className="text-sm">Orange</span>
              </div>
              <div className="bg-white p-3 text-center border rounded-md">
                <div className="h-4 bg-green-500 rounded mb-2"></div>
                <span className="text-sm">Green</span>
              </div>
              <div className="bg-white p-3 text-center border rounded-md">
                <div className="h-4 bg-blue-500 rounded mb-2"></div>
                <span className="text-sm">Blue</span>
              </div>
              <div className="bg-white p-3 text-center border rounded-md">
                <div className="h-4 bg-purple-500 rounded mb-2"></div>
                <span className="text-sm">Purple</span>
              </div>
              <div className="bg-white p-3 text-center border rounded-md">
                <div className="h-4 bg-red-600 rounded mb-2"></div>
                <span className="text-sm">Red</span>
              </div>
              <div className="bg-white p-3 text-center border rounded-md">
                <div className="h-4 bg-black rounded mb-2"></div>
                <span className="text-sm">Black</span>
              </div>
            </div>

            <div className="bg-green-600 text-white p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Ready to Join?</h2>
              <p className="mb-6">
                Whether for transformative or competitive purposes, karate nurtures champions in all aspects of life!
                Join Sensei Negin&apos;s karate class and begin your journey in the art of karate.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="inline-block bg-white text-green-600 font-bold py-2 px-6 rounded-lg text-center hover:bg-gray-100 transition"
                >
                  Register Now
                </Link>
                <Link
                  to="/contact"
                  className="inline-block bg-transparent border-2 border-white text-white font-bold py-2 px-6 rounded-lg text-center hover:bg-white hover:text-green-600 transition"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
