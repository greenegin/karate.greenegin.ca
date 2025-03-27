export default function ContactPage() {
  return (
    <div className="min-h-screen bg-green-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-3xl font-bold text-green-600 mb-6">Contact Sensei Negin</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-green-600 mr-3">📞</span>
                  <div>
                    <p className="font-medium">Phone</p>
                    <p>(604) 690-7121</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-3">✉️</span>
                  <div>
                    <p className="font-medium">Email</p>
                    <p>info@greenegin.ca</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-3">📍</span>
                  <div>
                    <p className="font-medium">Location</p>
                    <p>Lighthouse Christian Academy</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-4">Class Schedule</h2>
              <div className="bg-green-50 p-4 rounded-md">
                <p className="font-medium mb-2">Children&apos;s Classes (Ages 6-12)</p>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">•</span>
                    <span>Monday: 6:00 PM - 7:00 PM</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">•</span>
                    <span>Wednesday: 6:00 PM - 7:00 PM</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-8">
            <h2 className="text-xl font-semibold mb-4">Send a Message</h2>
            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter your name"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter your email"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter subject"
                />
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  id="message"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter your message"
                ></textarea>
              </div>
              
              <div>
                <button
                  type="submit"
                  className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
