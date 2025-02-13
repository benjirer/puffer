from .models import ConnectionLog

class IPLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Process the request and get the response
        response = self.get_response(request)
        
        # Log the connection after processing the request.
        user = request.user
        if user.is_authenticated:
            ip = self.get_client_ip(request)
            if ip:
                ConnectionLog.objects.create(user=user, ip_address=ip)
                
        return response

    def get_client_ip(self, request):
        """
        Retrieve the client IP address.
        Adjust this function if you're behind a proxy.
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            # X-Forwarded-For may contain multiple IPs. Take the first one.
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip