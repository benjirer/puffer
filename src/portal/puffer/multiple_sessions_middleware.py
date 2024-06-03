from django.shortcuts import redirect


class CheckMultipleSessionsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if request.user.is_authenticated and request.session.get("multiple_sessions"):
            # Clear the flag after setting the message
            request.session["multiple_sessions"] = False
            return render(request, "multiple_sessions_not_allowed.html")

        return response
